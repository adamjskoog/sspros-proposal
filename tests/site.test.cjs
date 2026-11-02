const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadSite({ results = true } = {}) {
  const dom = new JSDOM(read('index.html'), { url: 'https://example.test/proposal/', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({ matches: true });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  const context = dom.getInternalVMContext();
  if (results) vm.runInContext(read('eval-results.js'), context);
  vm.runInContext(read('calculator.js'), context);
  vm.runInContext(read('app.js'), context);
  return dom;
}

test('routine request displays the exact saved output; changing scenarios clears it', () => {
  const dom = loadSite();
  const d = dom.window.document;
  assert.equal(d.querySelector('#scenario').value, 'C01');
  assert.match(d.querySelector('#prepare').textContent, /View saved AI result/);
  d.querySelector('#prepare').click();
  assert.equal(d.querySelector('#demo-result').hidden, false);
  assert.equal(d.querySelector('#result-draft').textContent, dom.window.EVAL_RESULTS.cases.find(item => item.id === 'C01').handoff.draft_reply);
  d.querySelector('#scenario').value = 'C25';
  d.querySelector('#scenario').dispatchEvent(new dom.window.Event('change'));
  assert.equal(d.querySelector('#demo-result').hidden, true);
  d.querySelector('#prepare').click();
  assert.equal(d.querySelector('#copy-draft').hidden, true);
  assert.equal(d.querySelector('#review-badge').textContent, 'Human escalation');
  dom.window.close();
});

test('hard-case buttons select the matching saved result and move keyboard focus', () => {
  const dom = loadSite();
  const d = dom.window.document;
  d.querySelector('#case-chips button:last-child').click();
  assert.equal(d.querySelector('#scenario').value, 'C37');
  assert.equal(d.querySelector('#demo-result').hidden, false);
  assert.equal(d.activeElement.id, 'scenario');
  dom.window.close();
});

test('calculator clears invalid results and recovers; zero traffic retains overhead', () => {
  const dom = loadSite();
  const d = dom.window.document;
  function set(id, value) { const input = d.getElementById(id); input.value = value; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }
  assert.equal(d.querySelector('#hours').textContent, '72');
  set('review', '12');
  assert.ok(Number(d.querySelector('#hours').textContent) < 0);
  assert.match(d.querySelector('#value-direction').textContent, /adds .* hours of work/);
  for (const invalid of ['', '-1', '121', '0.3']) {
    set('review', invalid);
    assert.equal(d.querySelector('#hours').textContent, '—');
    assert.equal(d.querySelector('#review').getAttribute('aria-invalid'), 'true');
    assert.equal(d.querySelector('#value-error').hidden, false);
  }
  set('review', '2');
  assert.equal(d.querySelector('#hours').textContent, '72');
  set('requests', '0');
  assert.equal(d.querySelector('#hours').textContent, '-32');
  assert.equal(d.querySelector('#ai-year').textContent, '$0.00');
  dom.window.close();
});

test('a missing results file clearly identifies preset examples', () => {
  const dom = loadSite({ results: false });
  const d = dom.window.document;
  assert.equal(d.querySelector('#demo-mode').textContent, 'Illustrative examples');
  assert.match(d.querySelector('#prepare').textContent, /View example handoff/);
  assert.match(d.querySelector('#sample-note').textContent, /not an AI result/);
  assert.equal(d.querySelector('#ai-year').textContent, 'Not available');
  dom.window.close();
});

test('copying a draft and sharing the proposal use only the displayed content and canonical page URL', async () => {
  const dom = loadSite();
  const d = dom.window.document;
  let copied;
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async value => { copied = value; } } });
  d.querySelector('#prepare').click();
  d.querySelector('#copy-draft').click();
  await new Promise(setImmediate);
  assert.equal(copied, d.querySelector('#result-draft').textContent);
  assert.match(d.querySelector('#copy-status').textContent, /Copied/);
  dom.window.location.hash = 'plan';
  d.querySelector('#share').click();
  await new Promise(setImmediate);
  assert.equal(copied, 'https://example.test/proposal/');
  dom.window.close();
});

test('each page has valid local destinations, unique IDs, and contact details', () => {
  for (const file of ['index.html', 'service-concept.html', 'brief.html', 'role-summary.html']) {
    const dom = new JSDOM(read(file));
    const d = dom.window.document;
    const ids = [...d.querySelectorAll('[id]')].map(el => el.id);
    assert.equal(ids.length, new Set(ids).size, file + ' duplicate ID');
    assert.ok(d.querySelector('a[href^="mailto:adamjskoog@gmail.com"]'), file + ' contact missing');
    assert.ok(d.querySelector('a[href="tel:+18056240580"]'), file + ' phone missing');
    for (const element of d.querySelectorAll('a[href],link[href],script[src]')) {
      const link = element.getAttribute('href') || element.getAttribute('src');
      if (/^(https?:|mailto:|tel:|data:)/.test(link)) continue;
      const [target, hash] = link.split('#');
      assert.ok(fs.existsSync(path.join(root, target || file)), file + ' missing ' + link);
      if (hash) {
        const destination = new JSDOM(read(target || file));
        assert.ok(destination.window.document.getElementById(hash), file + ' missing anchor ' + link);
        destination.window.close();
      }
    }
    for (const input of d.querySelectorAll('input,select')) assert.ok(input.labels.length, 'Missing label for ' + input.id);
    dom.window.close();
  }
});
