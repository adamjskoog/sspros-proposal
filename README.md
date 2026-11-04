# SSPros proposal

An independent hiring proposal by Adam Skoog for discussion with System Solutions Pros. This is not the company's website. The revised offer starts with one approved website improvement and one follow-up routine, with agreed paid hours, compensation, access, approver, and completion criteria.

Open `index.html`, or serve this directory with `python -m http.server 8000 --bind 127.0.0.1` and visit `http://127.0.0.1:8000/`. The site is static and uses relative links. No messages are sent and no company systems are connected. The original opening and contact section remain unchanged.

## What to review

- `index.html`: the assignment, connected demonstration, responsibilities, 90-day decisions, budget, and optional worksheet.
- `service-concept.html`: a labeled commercial service-page concept leading to fictional inquiry C01.
- `evaluation.html`: what the development checks establish, known failures, and requirements before a trial.
- `brief.html` and its PDF: the three-page decision brief.
- `role-summary.html` and its PDF: the two-page role summary.
- `website-review.html` and its PDF: the six-page research appendix with 38 ideas.
- `downloads/office-kit/START-HERE.html`: three routines, workbook, fictional examples, CSV alternatives, and four editable message drafts.

The work sample displays original saved AI answers. Its separate reviewer edit and EX-101 record are illustrative. The revised automatic checks pass 39/40 fictional cases; one unsupported form-metadata claim fails. A passing pattern check is not a semantic or safety certification. See [evaluation instructions](eval/README.md).

## Maintained checks

The tested versions are declared in `package.json` and `requirements-docs.txt`. Use Node 22 or newer and Python 3.10 or newer. Install dependencies in your development environment:

```powershell
npm install
python -m pip install -r requirements-docs.txt
python -m pip install -r eval/requirements.txt
npm test
python tests/content_checks.py
python -m pytest eval -q -p no:cacheprovider
python eval/run_eval.py --dry-run
```

`npm test` runs 13 calculator and DOM interaction tests without launching a browser. They cover exact saved text, urgent and missing-details cases, failed checks, fallback labeling, copy/share behavior, focus changes, negative value, invalid input, and safe text insertion. The evaluation has 39 offline tests, including reproduction of the saved regrade and fictional export guards. Structural checks cover seven HTML pages, local destinations, label references, protected content, PDF page counts/bounds, and the workbook/CSV/ZIP contents. These checks do not establish layout or full accessibility.

For browser verification on a machine that can launch Chromium:

```powershell
npx playwright install chromium
npm run test:browser
```

The browser script checks desktop, 390px phone, and 320px narrow layouts, interactions, missing evaluation data, and horizontal overflow. Inspect its screenshots in `artifacts/revision-browser/` and manually check keyboard traversal, focus visibility, readability, and expanded sections. **This browser script has not been run successfully for the current revision:** process creation is blocked and the computer-use browser host is unavailable. See [REVISION-STATUS.md](REVISION-STATUS.md).

## Build the summaries

`toolkit/proposal-documents.json` is the shared content source for the three HTML documents and their PDFs. Edit it, then run:

```powershell
python tools/build-summaries.py
python tests/content_checks.py
```

The PyMuPDF builder rejects overflowing authored sheets instead of silently clipping them. PDFs use 12.5pt body text. Review every rendered page after changing the source or layout. Browser printing of the HTML uses separate print CSS and still needs a browser check; the downloadable PDFs are the verified print artifacts.

Office kit source and its separate generator are documented in [toolkit/README.md](toolkit/README.md). This revision preserves the existing workbook and archive; checks confirm that the ZIP matches all ten individual files.

## Public and private data

The tracked inquiries and outputs are fictional development fixtures. New evaluation outputs default to `../private-eval-results/`, outside this public repository. An explicit `--publish` and a fixture-hash allowlist are required to export into `eval-results.js`. The CLI supports an external `--dataset` path for future approved private evaluation. Never place real messages, working customer records, secrets, or private results in this static website directory. `noindex` metadata is not access control.

## Publication

The current revision is local and has not been published. Finish browser verification and review the package before release. GitHub Pages is configured to serve the repository's `main` branch root; committing and pushing affects the published copy. Keep the unchanged historical run in `eval/results/` as evidence, and keep `regraded.json` distinct from newly generated runs.