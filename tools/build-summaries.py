"""Build printable HTML and PDFs from one shared content file. Requires PyMuPDF."""
from pathlib import Path
import json
import pymupdf as fitz

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT/'toolkit/proposal-documents.json'
PRINT_CSS = '''
body { font-family: sans-serif; font-size: 12.5pt; line-height: 1.42; color: #142c29; }
h1 { font-size: 27pt; line-height: 1.15; margin: 10pt 0 18pt; }
h2 { font-size: 17pt; line-height: 1.2; margin: 18pt 0 8pt; color: #244b40; }
h3 { font-size: 13pt; margin: 13pt 0 5pt; }
p { margin: 8pt 0; } li { margin: 6pt 0; } ul,ol { padding-left: 19pt; }
.eyebrow { font-size: 10pt; color:#46564d; }
.lead { font-size: 14pt; }
.ask,.note { background:#ebeee4; padding:12pt; margin:12pt 0; }
.fine { font-size:10.5pt; color:#46564d; }
a { color:#244b40; }
'''


def build():
    source=json.loads(CONTENT.read_text(encoding='utf-8'))
    for name,document in source.items():
        sheets=document['pages']
        filename=document['pdf']
        pdf_path=ROOT/'downloads'/filename
        # Each authored sheet must fit a page; overflow fails instead of silently clipping.
        buffer=__import__('io').BytesIO()
        writer=fitz.DocumentWriter(buffer)
        for index,html in enumerate(sheets,1):
            story=fitz.Story(html=html,user_css=PRINT_CSS)
            more,_=story.place(fitz.Rect(48,44,564,740))
            if more:
                writer.close()
                raise RuntimeError(f'{name} sheet {index} overflows; shorten it or adjust layout.')
            device=writer.begin_page(fitz.Rect(0,0,612,792))
            story.draw(device)
            writer.end_page()
        writer.close()
        doc=fitz.open(stream=buffer.getvalue(),filetype='pdf')
        doc.set_metadata({'title':document['title'],'author':'Adam Skoog','subject':'Independent proposal for System Solutions Pros'})
        for index,p in enumerate(doc,1):
            p.insert_text((48,766),f'Adam Skoog | SSPros proposal | {index} / {len(doc)}',fontsize=9,color=(.27,.33,.29))
        doc.save(pdf_path)
        head=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{document["title"]}</title><link rel="icon" href="mark.svg" type="image/svg+xml"><link rel="stylesheet" href="documents.css"></head><body><nav class="tools" aria-label="Document actions"><a href="index.html">Back to the proposal</a><a href="downloads/{filename}" download>Download PDF</a><button type="button" onclick="window.print()">Print</button></nav><main>'
        (ROOT/name).write_text(head+''.join('<article class="sheet">'+p+'</article>' for p in sheets)+'</main></body></html>',encoding='utf-8')
        print(f'{name}: {len(doc)} PDF pages, {sum(len(p.get_text()) for p in doc)} text characters')


if __name__=='__main__': build()
