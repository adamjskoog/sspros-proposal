# SSPros proposal

An independent hiring proposal prepared for discussion with System Solutions Pros. This is not the company's official website.

The site contains a role proposal for Digital Operations & AI Automation, a work sample, an AI evaluation, a 90-day plan, and supporting downloads. All inquiries are fictional, and nothing connects to business systems.

## AI evaluation

[`eval/`](eval/) holds a working AI inquiry-triage pipeline (Claude, structured outputs, prompt caching), a 40-case hand-labeled test set, a deterministic grader, and offline tests. `eval/run_eval.py` writes `eval-results.js`, which the site uses to show the metrics and the real model outputs in the work sample. See [`eval/README.md`](eval/README.md).

## Publishing

This is a buildless static site. In GitHub repository settings, open **Pages** and select **Deploy from a branch**, then **main** and **/(root)**. The `.nojekyll` file preserves the static files without a Jekyll build.

Open `index.html` for the website or `brief.html` for the printable decision brief. All asset links are relative so the site can run under a GitHub Pages project path.

## Office routines

Section 3 previews three routines: customer follow-up, website updates, and a weekly handoff. [`downloads/office-kit/START-HERE.html`](downloads/office-kit/START-HERE.html) contains the guide and fictional examples. The Excel workbook has blank working tabs, dropdowns, and calculated follow-up flags. The ZIP includes the workbook, CSV alternatives, guide, and message drafts. See [`toolkit/README.md`](toolkit/README.md) for the shared source and rebuild instructions.

Search indexing is discouraged using robots metadata; this does not restrict public access.
