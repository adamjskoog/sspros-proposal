"""Run triage through the Claude Code CLI (`claude -p`) instead of the API.

This lets the evaluation run on a Claude subscription login with no API key.
The same frozen system prompt, schema, and model are used. Differences from the
API path: structured output is enforced by Claude Code's schema tool rather than
`output_config.format`, there is no server-side fallback, and each call carries a
small amount of Claude Code overhead. Costs are reported as the API-equivalent
price of the measured tokens, since a subscription run is not billed per token.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Callable

from pydantic import ValidationError

from triage import HANDOFF_SCHEMA, MODEL, PRICES, SYSTEM_PROMPT, Handoff, TriageResult, cost_of

CALL_TIMEOUT_S = 300


def find_claude() -> str | None:
    """Prefer the native executable behind the npm shim so arguments skip cmd.exe quoting."""
    shim = shutil.which("claude")
    if shim is None:
        return None
    native = Path(shim).parent / "node_modules" / "@anthropic-ai" / "claude-code" / "bin" / "claude.exe"
    return str(native) if native.exists() else shim


def build_command(executable: str, model: str, effort: str) -> list[str]:
    return [
        executable, "-p",
        "--model", model,
        "--effort", effort,
        "--system-prompt", SYSTEM_PROMPT,
        "--json-schema", json.dumps(HANDOFF_SCHEMA),
        "--output-format", "json",
        "--tools", "",                 # no file, shell, or web tools: the model can only answer
        "--setting-sources", "",       # ignore user hooks, plugins, and project settings
        "--strict-mcp-config",         # no MCP servers
        "--disable-slash-commands",
        "--no-session-persistence",
    ]


def _usage_dict(usage: dict) -> dict:
    keys = ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
    return {key: int(usage.get(key, 0) or 0) for key in keys}


def triage_claude_code(inquiry: str, model: str = MODEL, effort: str = "medium",
                       executable: str | None = None, runner: Callable = subprocess.run) -> TriageResult:
    executable = executable or find_claude()
    if executable is None:
        raise RuntimeError("Claude Code CLI not found on PATH")
    # Strip API credentials so the call uses the subscription login, as intended.
    env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
    started = time.perf_counter()
    proc = runner(build_command(executable, model, effort), input=f"<inquiry>\n{inquiry}\n</inquiry>",
                  capture_output=True, text=True, encoding="utf-8", timeout=CALL_TIMEOUT_S, env=env)
    wall = time.perf_counter() - started

    try:
        payload = json.loads(proc.stdout)
    except (json.JSONDecodeError, TypeError):
        detail = (proc.stderr or proc.stdout or "").strip()[:300]
        return TriageResult(handoff=None, error=f"cli_error: exit {proc.returncode}: {detail}", model_served=None,
                            stop_reason=None, usage={}, cost_usd=0.0, cost_estimated=False, latency_s=wall)

    usage = _usage_dict(payload.get("usage") or {})
    served = next(iter(payload.get("modelUsage") or {}), model)
    price_key = next((key for key in PRICES if served.startswith(key)), None)
    base = {"model_served": served, "stop_reason": payload.get("stop_reason"), "usage": usage,
            "cost_usd": cost_of(usage, price_key or model), "cost_estimated": price_key is None,
            "latency_s": (payload.get("duration_ms") or wall * 1000) / 1000}

    if payload.get("is_error"):
        return TriageResult(handoff=None, error=f"cli_error: {payload.get('subtype')}: {str(payload.get('result'))[:300]}", **base)
    output = payload.get("structured_output")
    if output is None:
        return TriageResult(handoff=None, error="no_structured_output", **base)
    try:
        return TriageResult(handoff=Handoff.model_validate(output), error=None, **base)
    except ValidationError as exc:
        return TriageResult(handoff=None, error=f"invalid_output: {exc}", **base)
