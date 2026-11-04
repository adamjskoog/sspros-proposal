"""Run the triage evaluation privately; explicitly export approved fictional fixtures.

Usage:
    python run_eval.py --dry-run            # validate the dataset, no API calls
    python run_eval.py                      # full run on claude-opus-5-5
    python run_eval.py --effort low         # compare effort levels
    python run_eval.py --limit 5            # quick smoke test
    python run_eval.py --backend claude-code  # run on a Claude subscription via the Claude Code CLI
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import anthropic

from claude_code_backend import find_claude, triage_claude_code
from grading import GRADER_VERSION, failed_checks, grade_case, summarize
from public_export import assert_public_export, file_hash
from triage import MODEL, PRICES, SYSTEM_PROMPT, Handoff, triage

HERE = Path(__file__).parent
DATASET = HERE / "dataset.jsonl"
RESULTS_DIR = HERE.parent.parent / "private-eval-results"
SITE_EXPORT = HERE.parent / "eval-results.js"
SHOWCASE_IDS = ("C01", "C18", "C21", "C25", "C26", "C34", "C36", "C19", "C37")
DEFAULT_EFFORT = "medium"


def load_dataset(limit: int | None, dataset: Path = DATASET) -> list[dict]:
    rows = [json.loads(line) for line in dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    return rows[:limit] if limit is not None else rows


def validate_dataset(cases: list[dict]) -> list[str]:
    fields = Handoff.model_fields
    allowed = {name: set(fields[name].annotation.__args__) for name in ("route", "urgency", "property_type", "service_category")}
    missing_allowed = set(fields["missing_fields"].annotation.__args__[0].__args__)
    problems = []
    for case in cases:
        expected = case["expected"]
        if expected.get("timing_given") and not expected.get("timing_patterns"):
            problems.append(f"{case['id']}: timing requires explicit expected patterns")
        for name, values in allowed.items():
            labels = expected.get(name)
            if labels is None:
                continue
            for label in (labels if isinstance(labels, list) else [labels]):
                if label not in values:
                    problems.append(f"{case['id']}: {name}={label!r} is not a schema value")
        for item in expected.get("missing_fields", []):
            if item not in missing_allowed:
                problems.append(f"{case['id']}: missing_fields item {item!r} is not a schema value")
    return problems


def run_case(client, case: dict, model: str, effort: str) -> dict:
    """`client` is an Anthropic client, or None to run through the Claude Code CLI."""
    row = {"id": case["id"], "tags": case["tags"], "inquiry": case["inquiry"], "expected": case["expected"]}
    try:
        if client is None:
            result = triage_claude_code(case["inquiry"], model=model, effort=effort)
        else:
            result = triage(client, case["inquiry"], model=model, effort=effort)
        handoff = result.handoff.model_dump() if result.handoff else None
        checks = grade_case(case["expected"], handoff, case.get("forbid")) if handoff else failed_checks(case["expected"])
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as exc:
        return error_row(row, f"api_error: {exc.__class__.__name__}: {exc}")
    except Exception as exc:  # Keep the paid results of every other case if one case breaks unexpectedly.
        return error_row(row, f"unexpected_error: {exc.__class__.__name__}: {exc}")
    return {**row, "error": result.error, "handoff": handoff, "predicted_route": handoff["route"] if handoff else None,
            "checks": checks, "usage": result.usage, "cost_usd": result.cost_usd, "cost_estimated": result.cost_estimated,
            "latency_s": result.latency_s, "model_served": result.model_served}


def error_row(row: dict, error: str) -> dict:
    return {**row, "error": error, "handoff": None, "predicted_route": None, "checks": failed_checks(row["expected"]),
            "usage": {}, "cost_usd": 0.0, "cost_estimated": False, "latency_s": 0.0, "model_served": None}


def should_update_site(args) -> bool:
    """Public export is always an explicit action, additionally guarded by fixture hashes."""
    return bool(args.publish)


def passed_all(row: dict) -> bool:
    return not row["error"] and all(value for value in row["checks"].values() if value is not None)


def print_report(summary: dict, rows: list[dict]) -> None:
    def ratio(metric: dict) -> str:
        return f"{metric['passed']}/{metric['total']}"

    print("\nResults")
    print(f"  All checks passed     {ratio(summary['all_checks_passed'])}")
    print(f"  Route accuracy        {ratio(summary['route_accuracy'])}")
    print(f"  Emergency recall      {ratio(summary['emergency_recall'])}  (target: all)")
    print(f"  False escalations     {summary['false_escalations']}")
    print(f"  Field accuracy        {ratio(summary['field_accuracy'])}")
    print(f"  Missing-detail exact  {ratio(summary['missing_fields_exact'])}")
    print(f"  Unsafe drafts         {summary['unsafe_drafts']}  (target: 0)")
    print(f"  Injections resisted   {ratio(summary['injection_resisted'])}")
    print(f"  Errors                {summary['errors']}")
    if summary["cost_estimated_cases"]:
        print(f"  Cost estimated        {summary['cost_estimated_cases']} cases served by an unpriced fallback model")
    print(f"  Cost                  ${summary['cost_usd']['total']:.4f} total, ${summary['cost_usd']['per_inquiry']:.5f} per inquiry")
    print(f"  Latency               p50 {summary['latency_s']['p50']}s, p95 {summary['latency_s']['p95']}s")
    print(f"  Cache hit rate        {summary['cache_hit_rate']:.0%}")
    failures = [row for row in rows if not passed_all(row)]
    if failures:
        print("\nCases to review")
        for row in failures:
            failed = [name for name, ok in row["checks"].items() if ok is False]
            print(f"  {row['id']}  {row['error'] or ', '.join(failed)}")


def save_results(summary: dict, rows: list[dict], meta: dict) -> Path:
    RESULTS_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    full = {"meta": meta, "summary": summary, "rows": rows}
    run_file = RESULTS_DIR / f"{stamp}-{meta['model']}-{meta['effort']}.json"
    for path in (run_file, RESULTS_DIR / "latest.json"):
        path.write_text(json.dumps(full, indent=2, ensure_ascii=False), encoding="utf-8")
    return run_file


def update_site(summary: dict, rows: list[dict], meta: dict) -> None:
    assert_public_export(rows, meta)
    showcase = [{"id": row["id"], "tags": row["tags"], "inquiry": row["inquiry"], "handoff": row["handoff"], "passed": passed_all(row)}
                for row in rows if row["id"] in SHOWCASE_IDS and row["handoff"]]
    cases = [{"id": row["id"], "tags": row["tags"], "inquiry": row["inquiry"], "expected_route": row["expected"]["route"],
              "expected_urgency": row["expected"]["urgency"], "handoff": row["handoff"], "passed": passed_all(row)}
             for row in rows]
    site = {"meta": meta, "summary": summary, "showcase": showcase, "cases": cases}
    SITE_EXPORT.write_text("window.EVAL_RESULTS = " + json.dumps(site, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default=MODEL, choices=sorted(PRICES))
    parser.add_argument("--effort", default=DEFAULT_EFFORT, choices=["low", "medium", "high"])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dataset", type=Path, default=DATASET,
                        help="input JSONL path; keep future real-message data outside this public repository")
    parser.add_argument("--backend", default="api", choices=["api", "claude-code"],
                        help="api: Anthropic API key; claude-code: the Claude Code CLI on a subscription login")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true", help="validate the dataset without calling the API")
    parser.add_argument("--no-save", action="store_true", help="do not write any result files")
    parser.add_argument("--publish", action="store_true", help="explicitly export allowlisted fictional fixtures to ../eval-results.js")
    parser.add_argument("--site-from-latest", action="store_true",
                        help="rebuild ../eval-results.js from the private results directory; requires --publish")
    args = parser.parse_args()

    if args.site_from_latest:
        if not args.publish:
            parser.error("--site-from-latest requires --publish; only approved fictional fixtures can be exported")
        saved = json.loads((RESULTS_DIR / "latest.json").read_text(encoding="utf-8"))
        update_site(saved["summary"], saved["rows"], saved["meta"])
        print(f"Rebuilt {SITE_EXPORT.name} from {RESULTS_DIR / 'latest.json'} ({len(saved['rows'])} cases).")
        return 0

    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    cases = load_dataset(args.limit, args.dataset)
    problems = validate_dataset(cases)
    if not cases or args.workers < 1:
        parser.error("provide at least one case and a positive worker count")
    if problems:
        print("Dataset problems:\n  " + "\n  ".join(problems))
        return 1
    print(f"Dataset OK: {len(cases)} cases. System prompt: {len(SYSTEM_PROMPT):,} characters.")
    if args.dry_run:
        return 0
    if args.publish:
        assert_public_export(cases, {"data_classification": "authored-fictional"})
    if args.backend == "claude-code":
        if find_claude() is None:
            print("Claude Code CLI not found. Install it and log in, then run again.")
            return 2
        client = None
    elif not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        print("No credentials found. Set ANTHROPIC_API_KEY, or use --backend claude-code (see README.md).")
        return 2
    else:
        client = anthropic.Anthropic(max_retries=4)
    print(f"Running {len(cases)} cases on {args.model} (effort: {args.effort}, backend: {args.backend}) ...")
    # Run one case first so the shared system prompt is cached before the parallel batch.
    rows = [run_case(client, cases[0], args.model, args.effort)]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows += list(pool.map(lambda case: run_case(client, case, args.model, args.effort), cases[1:]))

    summary = summarize(rows)
    print_report(summary, rows)
    if args.no_save:
        return 0
    meta = {"model": args.model, "effort": args.effort, "backend": args.backend, "cases": len(rows),
            "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "data_classification": "authored-fictional", "grader_version": GRADER_VERSION, "hash_format": "sha256-utf8-lf",
            "prompt_sha256": __import__('hashlib').sha256(SYSTEM_PROMPT.encode('utf-8')).hexdigest(),
            "dataset_sha256": file_hash(args.dataset), "grader_sha256": file_hash(HERE/'grading.py'),
            "runner_sha256": file_hash(Path(__file__)), "pipeline_sha256": file_hash(HERE/'triage.py'),
            "cli_backend_sha256": file_hash(HERE/'claude_code_backend.py'),
            "served_models": sorted({row["model_served"] for row in rows if row["model_served"]})}
    # Classification is earned from the fixture allowlist, never from names being removed.
    try:
        assert_public_export(rows, meta)
    except ValueError:
        meta['data_classification'] = 'private'
    print(f"\nSaved {save_results(summary, rows, meta)}")
    if should_update_site(args):
        update_site(summary, rows, meta)
        print(f"Updated {SITE_EXPORT.name} for the proposal site.")
    else:
        print("Site not updated. Public export always requires --publish and allowlisted fictional inputs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
