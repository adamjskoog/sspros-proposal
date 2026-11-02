# SSPros proposal

An independent hiring proposal by **Adam Skoog** for System Solutions Pros. Contact: **adamjskoog@gmail.com**. This is not the company's official website.

The proposed paid role is **Digital Operations & AI Automation**. The first assignment is an approved service page and a clearer inquiry handoff. The page leads with the work, the assignment, the 90-day plan, and direct email contact.

## Pages and supporting files

- `index.html`: the proposal, saved AI result viewer, and adjustable time estimate.
- `service-concept.html`: a complete proposed commercial project page. It collects no information.
- `brief.html`: the current two-page decision brief.
- `role-summary.html`: the current one-page role summary.
- `downloads/`: refreshed PDFs, the original website review, and blank office templates.

The proposal uses fictional inquiries and has no connection to company systems. The AI viewer replays exact recorded outputs; it makes no live model calls. If the results file is missing, the viewer explicitly labels its content as preset examples.

## Evaluation and claims

[`eval/`](eval/) contains the inquiry-triage pipeline, 40 hand-labeled fictional cases, a deterministic grader, and offline tests. `eval-results.js` supplies the displayed results. The viewer starts with C01, an ordinary commercial request, followed by C06 and the difficult showcase cases.

Public metrics describe passing the defined checks and replies flagged by the safety scan. They do not claim that every output is safe or that practice performance predicts real traffic. See [the evaluation README](eval/README.md) for methods and limitations.

## Local verification

The site is buildless and all local links are relative. Open `index.html` directly, or serve this directory with a local static server.

Development tools require Node.js 22.14 or newer and Python with the packages in `tools/requirements.txt`. Install JavaScript development dependencies with `npm install`.

- `npm test`: calculator and DOM interaction tests; no browser, API calls, or model usage.
- `npm run check:browser`: Chromium layout checks at 1440, 768, 390, and 320px, interactions, local links, fallback and no-JavaScript behavior. Screenshots and results go to ignored `artifacts/`.
- `npm run build:pdf`: rebuild both printable HTML summaries from shared copy and saved evaluation data, then render PDFs and page images with PyMuPDF.

Set `BROWSER_PATH` to an installed Chromium-family browser if Puppeteer's browser is unavailable. The browser check is optional when process creation is restricted; report that limitation instead of treating DOM checks as layout verification.

`tools/build-briefs.py` is the source for the printable copy and uses the same evaluation file as the site. Edit it and rebuild rather than editing generated summaries by hand. The PDF renderer fails if a page cannot fit at its intended type size.

## Current verification status

Eleven calculator and DOM tests pass. Both PDFs were rendered and visually checked. The browser check (npm run check:browser) passed on November 1, 2026 at 1440, 768, 390, and 320px.

## Publishing

The existing public site is https://adamjskoog.github.io/sspros-proposal/. GitHub Pages deploys the repository's `main` branch from `/(root)`. The `.nojekyll` file preserves static assets.

This revision is local until committed and pushed. Search indexing is discouraged using robots metadata; this does not restrict public access.
