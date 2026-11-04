# Inquiry triage development evaluation

This prototype extracts a fictional inquiry into a typed handoff: service, location, timing, property type, urgency, missing details, suggested route, next action, notes, and a draft reply. It does not assign staff, persist an operational queue, send replies, or create reminders.

The saved November 1 run used `claude-opus-5-5` with medium effort through the Claude Code backend. Regrading those same 40 answers with grader **2.0** yields **39/40 passing the automatic checks**, **6/6 labeled urgent cases escalated**, and **zero drafts flagged by the wording scan**. No new model calls were made for the regrade and no model answer was edited. These are development results on author-written fixtures, not independent validation or a safety certification.

## Known findings

- C25 fails the new source-boundary check: the model asserted that the website form lacked contact details, although only inquiry text was supplied.
- C19's reviewer notes inferred an overloaded circuit. The deterministic checks do not flag that inference; a qualified reviewer must assess it.
- The earlier grader could pass wrong timing and next-action content, a spelled-out price, and an appointment confirmation. Regression tests now reject those demonstrated examples. This does not prove all paraphrases or contradictions are caught.
- The service, coverage, urgency, and escalation rules in the prompt are development assumptions requiring company approval before use.

## What is checked

`grading.py` compares route, urgency, property type, missing fields, and allowed service categories with the authored labels. Locations use normalized equality: case, periods, spacing, Saint/St, and an optional Florida suffix/ZIP are normalized. It does not accept an arbitrary string merely containing the expected city.

When timing is present, maintained dataset cases require explicit expected regex patterns; all must match. When timing is absent, the result must be null. This is still pattern matching, not general semantic equivalence. C01 also has selected content requirements for its summary and next action. These checks do not assess every summary or next action in the set.

Cross-field checks reject emergency/route conflicts, drafts on escalation or spam routes, and selected inconsistent estimator handoffs. A narrow source-boundary pattern flags known form-metadata overclaims. Draft scans recognize common prices, appointment/availability promises, discounts, statistics, and safety advice; injection fixtures also list forbidden strings. Names such as `safe_draft` and `unsafe_drafts` are historical metric keys and mean only that these limited scans passed or flagged text.

Unusable output fails the applicable checks. The overall pass count also requires no recorded error. These are evaluation checks, not runtime enforcement: critical constraints still need an application boundary before operational integrations are added.

Structured output enforces shape and enums, not truth. Inquiry delimiters and prompt instructions do not guarantee resistance to malicious input. Prompt caching and backend fallbacks are implementation choices whose behavior and economics must be verified for the chosen deployment.

## Reproduce without a model call

From this directory:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider
.venv/Scripts/python.exe run_eval.py --dry-run
.venv/Scripts/python.exe regrade.py
```

There are 39 offline tests. The regrade reads the immutable historical file `results/20261101T200215Z-claude-opus-5-5-medium.json`, checks that its inquiries match the maintained dataset, and applies the current grader without changing its handoffs. It writes `results/regraded.json` and the local `../eval-results.js`; it does not deploy anything. `results/latest.json` remains the historical generation record.

The regrade records its time, grader version, dataset/grader/source-run hashes, and the original model configuration and generation time. Source-file hashes use UTF-8 text with LF line endings (`sha256-utf8-lf`) so Git's Windows newline conversion does not change them. The historical run did not record prompt/code hashes, so it cannot provide verified generation provenance for those files. New runs record prompt, dataset, grader, runner, pipeline, and CLI-backend hashes plus requested/served models.

## New runs and explicit public export

With approved credentials and a budget, `run_eval.py` can use an Anthropic API account or the existing Claude Code backend. Verify current model access and account terms before a new paid run. The saved token costs are historical estimates under the recorded pricing assumptions; they are not current quotes or subscription invoices.

```powershell
python run_eval.py --limit 5                  # API backend; credentials from the environment
python run_eval.py --backend claude-code     # requires an installed, logged-in CLI
python run_eval.py --effort low              # optional comparison
python run_eval.py --publish                 # explicitly export allowlisted fictional cases
python run_eval.py --site-from-latest --publish  # export last private saved run; no new calls
```

New results default to `../../private-eval-results/`, outside the public website repository, including a private `latest.json`. No default full run updates the website. `--publish` exports only when inputs exactly match IDs and inquiry hashes in `public-fixtures.json` and are classified as authored fiction. Unknown, modified, duplicate, or privately classified inputs are rejected. The manifest is a developer-reviewed fixture boundary, not a redaction or secret-detection system; do not expand it to admit real data. An explicit partial export changes the displayed totals and requires corresponding editorial review of summaries.

Future company-approved private inputs can be supplied with `--dataset ../../private-eval-data/cases.jsonl`. That file must follow the development dataset schema and have suitable reviewer-approved expectations. Keep both inputs and results in private storage, apply the agreed access/deletion controls, and omit `--publish`. Do not replace the tracked fictional dataset with real inquiries or commit a private working folder. The current prototype has not been approved for real company data.

## Review before a trial

Use a human rubric covering factual traceability, correct extraction, appropriate next action, useful draft questions, unsupported claims, and exception handling. Label a separate held-out set with qualified company staff before tuning against it. Include negation, historical hazards, mixed requests, missing contact information, non-English messages, and instruction injection. Keep that set private when it contains approved real examples.

Compare with the existing process and approved templates; measure review/correction time as well as accuracy. Repeat critical cases to assess variability. Define company-owned escalation and accepted handoffs, deterministic enforcement, durable state, timeouts, duplicate handling, approval records, a pause mechanism, and a staffed fallback before connecting any operational actions. None of that future validation is claimed by the 40 development cases.
