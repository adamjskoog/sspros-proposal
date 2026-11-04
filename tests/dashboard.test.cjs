const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { sortMessage } = require('../sorter.js');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const savedResults = () => JSON.parse(read('eval-results.js').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
const KEY = 'sspros-dashboard-v1';

let counter = 0;
function open({ query = '', recorded = true, results, storage, brokenStorage = false } = {}) {
  const dom = new JSDOM(read('dashboard.html'), { runScripts: 'outside-only', url: `https://t${++counter}.example.test/dashboard.html${query}` });
  const w = dom.window;
  if (brokenStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } });
  else if (storage) w.localStorage.setItem(KEY, JSON.stringify(storage));
  if (results) w.EVAL_RESULTS = results;
  else if (recorded) w.eval(read('eval-results.js'));
  w.eval(read('sorter.js'));
  w.eval(read('dashboard-data.js'));
  w.eval(read('dashboard.js'));
  const get = id => w.document.getElementById(id);
  const ids = lane => [...get('lane-' + lane).querySelectorAll('.dcard')].map(c => c.dataset.id);
  const click = id => w.document.querySelector(`.dcard[data-id="${id}"]`).click();
  const change = (id, value) => { get(id).value = value; get(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
  const submit = id => get(id).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const stored = () => JSON.parse(w.localStorage.getItem(KEY));
  return { dom, w, get, ids, click, change, submit, stored };
}
const closeAll = (t, ...doms) => t.after(() => doms.forEach(d => d.window.close()));

/* ---------- Sorting rules ---------- */
test('the safety check sends hazards to a person, in English and Spanish', () => {
  for (const text of ['The outlet sparked and smells like burning plastic', 'Hola, huele a quemado cerca del panel', 'Water is dripping onto the breaker panel', 'I got a shock from the light switch']) {
    const r = sortMessage(text);
    assert.equal(r.lane, 'urgent', text);
    assert.equal(r.draft, null, 'no automatic reply for hazards');
    assert.ok(r.hazards.length);
  }
});

test('ordinary messages go to the right lane with honest missing details', () => {
  const quote = sortMessage('Need a quote for four EV chargers at our office in Orlando next month');
  assert.equal(quote.lane, 'electrical'); assert.deepEqual(quote.missing, []);
  const vague = sortMessage('Do you install generators? How much?');
  assert.equal(vague.lane, 'comms'); assert.deepEqual(vague.missing, ['location', 'timing']);
  assert.match(vague.draft, /city or ZIP/);
  const web = sortMessage('Your Google listing has the wrong hours');
  assert.equal(web.lane, 'web'); assert.deepEqual(web.missing, []);
  assert.equal(sortMessage('   '), null);
});

/* ---------- Board ---------- */
test('the board loads saved answers and written examples into the right lanes', t => {
  const { dom, get, ids } = open(); closeAll(t, dom);
  assert.deepEqual(new Set(ids('urgent')), new Set(['C21', 'C25', 'C26', 'P1']));
  assert.deepEqual(new Set(ids('electrical')), new Set(['C01', 'C34', 'E1', 'E2']));
  assert.deepEqual(new Set(ids('comms')), new Set(['C18', 'C37', 'P2', 'T1']), 'done items are hidden by default');
  assert.deepEqual(new Set(ids('web')), new Set(['W1', 'W2', 'W3']));
  assert.equal(get('stat-urgent').textContent, '4');
  assert.equal(get('stat-done').textContent, '2');
  assert.equal(get('saved-note').hidden, true);
  assert.equal(get('panel').hidden, true);
});

test('a saved card shows the exact recorded AI answer', t => {
  const { dom, w, get } = open({ query: '?case=C01' }); closeAll(t, dom);
  const source = w.EVAL_RESULTS.cases.find(c => c.id === 'C01').handoff;
  assert.equal(get('panel').hidden, false);
  assert.equal(get('panel-kind').textContent, 'Saved AI answer');
  assert.equal(get('panel-service').textContent, source.service_summary);
  assert.equal(get('panel-next').textContent, source.next_action);
  assert.equal(get('f-draft').value, source.draft_reply);
  assert.equal(get('f-assignee').value, 'estimator');
});

test('urgent items have no reply box, only a call-back action', t => {
  const { dom, get, click } = open(); closeAll(t, dom);
  click('P1');
  assert.equal(get('panel-kind').textContent, 'Written example');
  assert.equal(get('draft-block').hidden, true);
  assert.match(get('no-draft').textContent, /calls this customer directly/);
  assert.equal(get('btn-called').hidden, false);
  assert.equal(get('btn-approve').hidden, true);
  get('btn-called').click();
  assert.equal(get('stat-urgent').textContent, '3');
  assert.match(get('panel-log').textContent, /Called back by On-call lead/);
});

test('approving an edited reply updates status, history, and saved state', t => {
  const { dom, w, get, click, stored } = open(); closeAll(t, dom);
  click('T1');
  get('f-draft').value = 'Hi Maria, Thursday works. See you then.';
  get('btn-approve').click();
  const card = w.document.querySelector('.dcard[data-id="T1"]');
  assert.match(card.textContent, /Waiting on customer/);
  assert.match(get('panel-log').textContent, /Reply approved by Alex \(edited\)\. Example only; nothing was sent\./);
  assert.equal(stored().overrides.T1.draft, 'Hi Maria, Thursday works. See you then.');
  assert.equal(get('btn-approve').disabled, true);
  assert.match(get('toast').textContent, /Approved/);
});

test('reassigning, moving lanes, escalating, and notes are all logged', t => {
  const { dom, get, ids, click, change, submit } = open(); closeAll(t, dom);
  click('W2');
  change('f-assignee', 'owner');
  assert.match(get('panel-log').textContent, /Assigned to Owner/);
  change('f-lane', 'comms');
  assert.ok(ids('comms').includes('W2'));
  get('btn-escalate').click();
  assert.ok(ids('urgent').includes('W2'));
  get('f-note').value = 'Owner says we close at 5.';
  submit('note-form');
  assert.match(get('panel-note-list').textContent, /we close at 5/);
  assert.equal(get('f-note').value, '');
});

test('filters, search, and show-done narrow the board', t => {
  const { dom, w, get, ids } = open(); closeAll(t, dom);
  for (const s of ['website', 'email', 'text']) w.document.querySelector(`[data-source="${s}"]`).click();
  assert.deepEqual(ids('urgent'), ['P1']);
  assert.deepEqual(ids('comms'), ['P2']);
  assert.equal(get('empty-web').hidden, false);
  w.document.querySelector('[data-source="phone"]').click();
  assert.equal(w.document.querySelector('[data-source="phone"]').getAttribute('aria-pressed'), 'true', 'the last source cannot be switched off');
  for (const s of ['website', 'email', 'text']) w.document.querySelector(`[data-source="${s}"]`).click();
  get('search').value = 'lakeland'; get('search').dispatchEvent(new w.Event('input'));
  assert.deepEqual(ids('electrical'), ['E1']);
  assert.match(get('result-count').textContent, /Showing 1 of 17/);
  get('search').value = ''; get('search').dispatchEvent(new w.Event('input'));
  get('show-done').checked = true; get('show-done').dispatchEvent(new w.Event('change'));
  assert.ok(ids('comms').includes('T2') && ids('comms').includes('C36'));
});

test('the new-message form validates, sorts, and opens the new item', t => {
  const { dom, w, get, submit, ids, stored } = open(); closeAll(t, dom);
  get('open-new').click();
  submit('new-form');
  assert.equal(get('n-error').hidden, false);
  assert.equal(get('n-from').getAttribute('aria-invalid'), 'true');
  w.document.querySelector('[data-example^="phone|Linda"]').click();
  submit('new-form');
  const added = stored().added[0];
  assert.equal(added.lane, 'urgent');
  assert.ok(ids('urgent').includes(added.id));
  assert.equal(get('panel-kind').textContent, 'Sorted in your browser');
  assert.match(get('panel-notes').textContent, /“sparks”/);
  assert.equal(get('stat-urgent').textContent, '5');
  assert.match(get('toast').textContent, /Sorted into Needs a person now/);
});

test('typed text is shown as text, never as HTML', t => {
  const { dom, w, get, submit } = open(); closeAll(t, dom);
  get('open-new').click();
  get('n-from').value = '<b>Mallory</b>';
  get('n-message').value = '<img src=x onerror=alert(1)> please call about the panel in Tampa tomorrow';
  submit('new-form');
  assert.equal(get('panel-message').querySelector('img'), null);
  assert.match(get('panel-message').textContent, /<img src=x/);
  assert.equal(w.document.querySelector('.dcard b'), null);
});

test('team names can be set and show across the board', t => {
  const { dom, w, get, submit, click } = open(); closeAll(t, dom);
  get('open-team').click();
  get('team-form').elements.estimator.value = 'Rick';
  submit('team-form');
  assert.equal(get('lane-person-electrical').textContent, 'Rick');
  click('E1');
  assert.match(get('f-assignee').selectedOptions[0].textContent, /Rick · Estimator/);
  assert.match(w.document.querySelector('.dcard[data-id="E1"]').textContent, /Rick/);
});

test('reset restores the original example', t => {
  const { dom, get, click, ids } = open({ storage: { overrides: { T1: { lane: 'urgent', log: [] } }, added: [], team: { office: 'Pat' } } }); closeAll(t, dom);
  assert.ok(ids('urgent').includes('T1'));
  assert.equal(get('lane-person-comms').textContent, 'Pat');
  click('T1');
  get('reset').click();
  assert.ok(ids('comms').includes('T1'));
  assert.equal(get('lane-person-comms').textContent, 'Alex');
  assert.equal(get('panel').hidden, true);
});

test('the dashboard still works when browser storage is blocked or corrupt', t => {
  const blocked = open({ brokenStorage: true });
  const corrupt = open({ storage: 'not an object' });
  closeAll(t, blocked.dom, corrupt.dom);
  assert.equal(blocked.ids('urgent').length, 4);
  blocked.click('T1'); blocked.get('btn-approve').click();
  assert.match(blocked.w.document.querySelector('.dcard[data-id="T1"]').textContent, /Waiting on customer/);
  assert.equal(corrupt.ids('urgent').length, 4);
});

test('without saved answers, only written examples show and the page says so', t => {
  const { dom, get, ids } = open({ recorded: false }); closeAll(t, dom);
  assert.deepEqual(ids('urgent'), ['P1']);
  assert.equal(get('saved-note').hidden, false);
});

test('saved model text is inserted as text', t => {
  const fixture = savedResults();
  fixture.cases.find(c => c.id === 'C01').inquiry = '<script>alert(1)</script> office build-out';
  const { dom, get } = open({ results: fixture, query: '?case=C01' }); closeAll(t, dom);
  assert.equal(get('panel-message').children.length, 0);
  assert.match(get('panel-message').textContent, /<script>/);
});

test('Escape closes the panel and returns focus to the card', t => {
  const { dom, w, get, click } = open(); closeAll(t, dom);
  click('E1');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(get('panel').hidden, true);
  assert.equal(w.document.activeElement.dataset.id, 'E1');
});
