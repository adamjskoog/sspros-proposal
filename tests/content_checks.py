"""Offline package integrity; does not establish browser rendering or accessibility."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import Counter
from zipfile import ZipFile
from hashlib import sha256
from openpyxl import load_workbook
import pymupdf
import json
import csv

ROOT = Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []; self.links = []; self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        for key in ('href', 'src'):
            if key in attrs: self.links.append(attrs[key])
        for key in ('aria-labelledby', 'aria-describedby', 'aria-controls', 'for'):
            if key in attrs: self.references.extend(attrs[key].split())


pages = {}
for path in [*ROOT.glob('*.html'), ROOT/'downloads/office-kit/START-HERE.html']:
    parser = Page(); parser.feed(path.read_text(encoding='utf-8'))
    pages[path.resolve()] = parser
for path, page in pages.items():
    assert all(n == 1 for n in Counter(page.ids).values()), path
    assert all(ref in page.ids for ref in page.references), (path, page.references)
    for link in page.links:
        url = urlsplit(link)
        if url.scheme or url.netloc: continue
        target = (path.parent/unquote(url.path)).resolve() if url.path else path
        assert target.exists(), (path, link)
        if url.fragment and target.suffix == '.html':
            assert target in pages and unquote(url.fragment) in pages[target].ids, (path, link)

index = (ROOT/'index.html').read_text(encoding='utf-8')
protected = json.loads((ROOT/'tests/protected-content.json').read_text())
for name, start, end in [
    ('hero', '    <section class="hero', '    <nav class="scope-strip'),
    ('conversation', '    <section id="conversation"', '    <section id="resources"'),
]:
    section = index[index.index(start):index.index(end)]
    assert sha256(section.encode()).hexdigest() == protected[name], name
doc_protected = json.loads((ROOT/'tests/protected-document-text.json').read_text(encoding='utf-8'))
for key, name in [('brief_opening','brief.html'),('brief_contact','brief.html'),('role_opening','role-summary.html')]:
    assert doc_protected[key] in (ROOT/name).read_text(encoding='utf-8'), key

documents = json.loads((ROOT/'toolkit/proposal-documents.json').read_text(encoding='utf-8'))
for name, source in documents.items():
    html = (ROOT/name).read_text(encoding='utf-8')
    assert all(sheet in html for sheet in source['pages']), name
    doc = pymupdf.open(ROOT/'downloads'/source['pdf'])
    assert len(doc) == len(source['pages']), name
    for i, page in enumerate(doc):
        assert len(page.get_text()) > 200, (name, i)
        for block in page.get_text('blocks'):
            assert block[0] >= 40 and block[2] <= 572 and block[3] < 780, (name, i, block)
    assert '805-624-0580' in ''.join(page.get_text() for page in doc) or name == 'website-review.html'
assert len(documents['brief.html']['pages']) == 3
assert len(documents['role-summary.html']['pages']) == 2

workbook = load_workbook(ROOT/'downloads/office-kit/SSPros-Office-Routines.xlsx')
assert workbook.sheetnames == ['Follow-ups', 'Website updates', 'Weekly handoff', 'Examples']
for sheet in workbook:
    assert sheet.sheet_view.showGridLines is False
    if sheet.title == 'Examples': continue
    inputs = 8 if sheet.title == 'Follow-ups' else sheet.max_column
    assert all(sheet.cell(r,c).value is None for r in range(8,58) for c in range(1,inputs+1))
    assert sheet.freeze_panes == 'C8'
    assert len(sheet.tables) == 1
    assert len(sheet.data_validations.dataValidation) >= 1
assert all(workbook['Follow-ups'].cell(r,9).data_type == 'f' for r in range(8,58))
assert workbook['Examples']['E9'].is_date
assert str(workbook['Examples']['E9'].value.date()) == '2026-11-02'
for routine in json.loads((ROOT/'toolkit/routines.json').read_text(encoding='utf-8')):
    for kind in ['blank', 'examples']:
        with (ROOT/f'downloads/office-kit/{routine["id"]}-{kind}.csv').open(encoding='utf-8-sig', newline='') as f:
            rows = list(csv.reader(f))
        assert rows[0] == routine['headers']
        assert all(len(row) == len(routine['headers']) for row in rows)
        assert len(rows) == (1 if kind == 'blank' else 4)
with ZipFile(ROOT/'downloads/sspros-office-templates.zip') as archive:
    assert len(archive.namelist()) == 10
    for name in archive.namelist():
        assert archive.read(name) == (ROOT/'downloads/office-kit'/name).read_bytes()
print(f'PASS: {len(pages)} HTML pages; local links and anchors; protected material; 11 PDF pages; workbook, CSV and ZIP integrity.')
