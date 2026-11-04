# Local revision verification — November 3, 2026

The proposal revision is implemented locally and has not been published. It is ready for content review. A functioning-browser review remains necessary before calling it ready to send.

## Changes

- Preserved the original opening and entire contact/conversation section; captured hashes verify exact text and markup.
- Defined one first paid assignment, its deliverables, company inputs, and acceptance criteria.
- Connected the commercial page concept to original saved C01 output, an explicitly illustrative reviewer edit, and office record EX-101.
- Separated current evidence, employee responsibilities, and future integrations. Moved detailed value assumptions into an optional worksheet that retains losses and includes review, maintenance, and setup.
- Clarified the $400 ceiling including tax, account ownership, outages, and approval of additional services.
- Added grading regressions, cross-field checks, explicit timing patterns, selected content checks, and a known unsupported-claim check. Regrading preserved all 40 answers and changed the reported pass count to 39/40.
- Made evaluation output private by default and restricted explicit public exports to allowlisted fictional inputs. Added external input-path support for future approved private evaluation.
- Synchronized the three-page brief, two-page role summary, and six-page research appendix through a shared content source. Kept the existing office kit intact.

## Completed verification

- 13 calculator and DOM tests passed using `node --test --test-isolation=none tests/proposal.test.cjs`. In-process test execution avoids this environment's intermittent denial of child process creation.
- 39 evaluation tests passed using `eval/.venv/Scripts/python.exe -m pytest eval -q -p no:cacheprovider` from the repository root. This includes recomputing the regrade, checking provenance hashes, preserving original answers, and rejecting unsuitable public exports.
- Dataset validation passed for all 40 fictional cases without model calls.
- `python tests/content_checks.py` passed: seven HTML pages, local links and cross-file anchors, unique IDs, label references, protected sections, generated-document source consistency, PDF counts/bounds, workbook structure, typed dates, formulas, dropdowns, CSV schemas, and exact ZIP contents.
- All 11 downloadable PDF pages were rendered and visually inspected. Page breaks, body type, margins, numbered lists, contact text, and footers were checked. The brief is three pages and the role summary two, matching their links.

These checks do not substitute for actual browser layout/accessibility testing or operation in Excel. The workbook was unchanged; automated checks opened its contents and compared the entire archive with the individual downloads.

## Still open

Chromium launch failed with `spawn EPERM`; computer-use reported that the native pipe and browser host are unavailable. Desktop/phone rendering, browser printing, full keyboard traversal, focus visibility, and a visual check of expanded content have therefore not been completed for this revision. The maintained `tools/browser-qa.cjs` script is ready for a machine where Chromium can launch; its own browser execution remains unverified. See README setup commands.

After browser checks and content review, prepare the release and verify the published links/downloads. Company approval of facts, paid terms, data handling, held-out validation, and operational controls belongs to the later assignment/pilot process; the proposal describes those as future work.