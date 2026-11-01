"""Offline tests for the Claude Code CLI backend. No CLI process is started."""
import json
from types import SimpleNamespace

from claude_code_backend import build_command, triage_claude_code

HANDOFF = {
    "service_category": "electrical", "service_summary": "Panel upgrade", "location": "Riverview", "timing": "Spring",
    "property_type": "residential", "urgency": "routine", "missing_fields": [], "route": "estimator",
    "next_action": "Assign an estimator.", "draft_reply": "Thanks for reaching out.", "reviewer_notes": "",
}


def fake_runner(payload=None, stdout=None, returncode=0):
    calls = []

    def run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(stdout=stdout if stdout is not None else json.dumps(payload), stderr="", returncode=returncode)
    return run, calls


def payload(**overrides):
    base = {"is_error": False, "subtype": "success", "stop_reason": "tool_use", "duration_ms": 2500,
            "structured_output": HANDOFF, "modelUsage": {"claude-opus-5-5": {}},
            "usage": {"input_tokens": 100, "output_tokens": 200, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 1000}}
    return {**base, **overrides}


def test_command_disables_tools_settings_and_mcp():
    cmd = build_command("claude", "claude-opus-5-5", "medium")
    assert cmd[cmd.index("--tools") + 1] == ""
    assert cmd[cmd.index("--setting-sources") + 1] == ""
    assert "--strict-mcp-config" in cmd and "--no-session-persistence" in cmd


def test_valid_output_becomes_handoff_with_api_equivalent_cost():
    run, calls = fake_runner(payload())
    result = triage_claude_code("Upgrade my panel", executable="claude", runner=run)
    assert result.error is None and result.handoff.route == "estimator"
    assert result.latency_s == 2.5
    assert abs(result.cost_usd - (100 * 4 + 200 * 20 + 1000 * 0.2) / 1e6) < 1e-12
    cmd, kwargs = calls[0]
    assert kwargs["input"] == "<inquiry>\nUpgrade my panel\n</inquiry>"
    assert "ANTHROPIC_API_KEY" not in kwargs["env"]


def test_cli_crash_is_an_error_not_an_exception():
    run, _ = fake_runner(stdout="not json", returncode=1)
    result = triage_claude_code("x", executable="claude", runner=run)
    assert result.handoff is None and result.error.startswith("cli_error: exit 1")


def test_cli_reported_error_and_missing_or_invalid_output():
    run, _ = fake_runner(payload(is_error=True, subtype="error_max_turns", result="limit"))
    assert triage_claude_code("x", executable="claude", runner=run).error.startswith("cli_error: error_max_turns")
    run, _ = fake_runner(payload(structured_output=None))
    assert triage_claude_code("x", executable="claude", runner=run).error == "no_structured_output"
    run, _ = fake_runner(payload(structured_output={**HANDOFF, "route": "bogus"}))
    assert triage_claude_code("x", executable="claude", runner=run).error.startswith("invalid_output")
