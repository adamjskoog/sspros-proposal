# Office kit source

`routines.json` supplies the workbook, CSVs, guide, and the preview in Section 3. `message-drafts.md` supplies the editable message drafts. The generated files live in `downloads/office-kit/`; the existing ZIP download URL is retained.

Build using the bundled `@oai/artifact-tool` runtime. Copy `tools/build-office-kit.mjs` into a temporary directory with `node_modules` linked to the runtime dependency directory, then run:

```
node build-office-kit.mjs C:/Users/adamj/Desktop/Projects/SSPros/github-pages
```

The builder checks ten follow-up states, restores the blank template, exports the workbook, and renders review images to the ignored `artifacts/office-kit/` folder. Rebuild the ZIP with the contents of `downloads/office-kit/` after reviewing the output. Keep the ZIP and individual downloads in sync.

The HTML guide is self-contained and opens offline. CSVs preserve editable input columns but have no formulas or dropdowns. Workbook dates are typed dates; example CSV dates use ISO notation. No customer data or integrations are included.
