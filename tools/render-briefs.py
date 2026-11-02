"""Generate the current PDF downloads directly from the shared HTML summaries."""
import re
import runpy
from pathlib import Path
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT / "tools" / "build-briefs.py"))
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
CSS = """
body { font-family: sans-serif; font-size: 11pt; line-height: 1.42; color: #142c29; }
h1 { font-size: 27pt; line-height: 1.12; margin: 15pt 0; }
h2 { font-size: 15pt; line-height: 1.25; margin: 16pt 0 7pt; }
p { margin: 8pt 0; }
a { color: #244b40; }
.eyebrow { font-size: 8.5pt; color: #46564d; }
.author { font-size: 10pt; }
.lead { font-size: 14pt; line-height: 1.4; }
.small { font-size: 9pt; color: #46564d; }
.sheet-title { font-size: 23pt; margin-top: 0; }
.phase-lines p { margin: 13pt 0; }
ul { padding-left: 17pt; margin: 7pt 0; }
li { margin: 4pt 0; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th,td { padding: 9pt; border-bottom: 1px solid #c9d1c2; text-align: left; vertical-align: top; }
th { width: 24%; background: #ebeee4; }
.ask { border-top: 2px solid #244b40; margin-top: 15pt; padding-top: 2pt; }
"""
for source, filename in [("brief.html", "SSPros-Decision-Brief.pdf"), ("role-summary.html", "SSPros-Role-Summary.pdf")]:
    html = (ROOT / source).read_text(encoding="utf-8")
    sheets = re.findall(r'<section class="brief-sheet">(.*?)</section>', html, re.S)
    document = fitz.open()
    for index, sheet in enumerate(sheets):
        page = document.new_page(width=612, height=792)
        spare, scale = page.insert_htmlbox(fitz.Rect(44, 40, 568, 744), sheet, css=CSS, scale_low=1)
        if spare < 0:
            raise RuntimeError(f"{source} page {index + 1} overflows; edit the layout before publishing")
        page.insert_text((44, 768), f"Adam Skoog | Independent SSPros proposal | November 2026", fontsize=8, color=(.27, .34, .30))
        page.insert_text((546, 768), str(index + 1), fontsize=8, color=(.27, .34, .30))
    document.set_metadata({"title": "SSPros Decision Brief" if source == "brief.html" else "SSPros Role Summary", "author": "Adam Skoog"})
    output = ROOT / "downloads" / filename
    document.save(output, garbage=4, deflate=True)
    for index, page in enumerate(document):
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(ARTIFACTS / f"{Path(source).stem}-page-{index + 1}.png")
        assert "adamjskoog@gmail.com" in page.get_text() or source == "brief.html", "Missing contact"
    print(f"{filename}: {len(document)} pages, all fit without scaling")
    document.close()
