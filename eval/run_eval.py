"""Run the triage evaluation and publish a summary for the proposal site.

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
from grading import failed_checks, grade_case, summarize
from triage import MODEL, PRICES, SYSTEM_PROMPT, Handoff, triage

HERE = Path(__file__).parent
DATASET = HERE / "dataset.jsonl"
RESULTS_DIR = HERE / "results"
SITE_EXPORT = HERE.parent / "eval-results.js"
SHOWCASE_IDS = ("C25", "C26", "C34", "C36", "C19", "C37")
DEFAULT_EFFORT = "medium"


def load_dataset(limit: int | None) -> list[dict]:
    rows = [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]
    return rows[:limit] if limit is not None else rows


def validate_dataset(cases: list[dict]) -> list[str]:
    fields = Handoff.model_fields
    allowed = {name: set(fields[name].annotation.__args__) for name in ("route", "urgency", "property_type", "service_category")}
    missing_allowed = set(fields["missing_fields"].annotation.__args__[0].__args__)
    problems = []
    for case in cases:
        expected = case["expected"]
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
    """Only a full run with the published configuration may replace the numbers on the site."""
    is_default = args.limit is None and args.model == MODEL and args.effort == DEFAULT_EFFORT
    return bool(args.publish or is_default)


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
    parser.add_argument("--backend", default="api", choices=["api", "claude-code"],
                        help="api: Anthropic API key; claude-code: the Claude Code CLI on a subscription login")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true", help="validate the dataset without calling the API")
    parser.add_argument("--no-save", action="store_true", help="do not write any result files")
    parser.add_argument("--publish", action="store_true", help="update the site even for a partial or non-default run")
    parser.add_argument("--site-from-latest", action="store_true",
                        help="rebuild ../eval-results.js from results/latest.json without calling the model")
    args = parser.parse_args()

    if args.site_from_latest:
        saved = json.loads((RESULTS_DIR / "latest.json").read_text(encoding="utf-8"))
        update_site(saved["summary"], saved["rows"], saved["meta"])
        print(f"Rebuilt {SITE_EXPORT.name} from results/latest.json ({len(saved['rows'])} cases).")
        return 0

    cases = load_dataset(args.limit)
    problems = validate_dataset(cases)
    if problems:
        print("Dataset problems:\n  " + "\n  ".join(problems))
        return 1
    print(f"Dataset OK: {len(cases)} cases. System prompt: {len(SYSTEM_PROMPT):,} characters.")
    if args.dry_run:
        return 0
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
            "served_models": sorted({row["model_served"] for row in rows if row["model_served"]})}
    print(f"\nSaved {save_results(summary, rows, meta).relative_to(HERE)}")
    if should_update_site(args):
        update_site(summary, rows, meta)
        print(f"Updated {SITE_EXPORT.name} for the proposal site.")
    else:
        print("Site not updated (partial or non-default run). Add --publish to override.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
