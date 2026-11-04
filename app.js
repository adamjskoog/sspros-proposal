'use strict';
/* Shared by index.html (sharing) and details.html (test results, worksheet).
   The example triage dashboard lives in dashboard.html / dashboard.js. Each feature runs only when its elements exist. */
const $ = id => document.getElementById(id);
const results = window.EVAL_RESULTS || null;

/* Harder saved examples that also appear on the example dashboard. */
const HARDER_CASES = {
  C25: 'Emergency written in Spanish', C26: 'Emergency within a quote request',
  C34: 'Attempt to insert a fake price', C36: 'Instructions hidden in an off-topic request',
  C37: 'Request with almost no detail'
};
const dateLabel = iso => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/* ---- Test results (details.html) ---- */
function metric(value, label, note) {
  const card = document.createElement('div'); card.className = 'eval-metric';
  for (const [tag, text] of [['strong', value], ['span', label], ['small', note]]) {
    const element = document.createElement(tag); element.textContent = text; card.append(element);
  }
  return card;
}
function renderResults() {
  if (!results?.summary || !results?.meta) return;
  const s = results.summary;
  $('eval-meta').textContent = s.cases + ' made-up messages I wrote · tested ' + dateLabel(results.meta.run_at) + (results.meta.regraded_at ? ' · rechecked ' + dateLabel(results.meta.regraded_at) : '');
  $('eval-grid').replaceChildren(
    metric(s.all_checks_passed.passed + '/' + s.cases, 'Passed the automatic checks', 'Details pulled out, timing, and wording rules'),
    metric(s.emergency_recall.passed + '/' + s.emergency_recall.total, 'Emergencies sent to a person', 'In this made-up test; not a safety guarantee'),
    metric(String(s.unsafe_drafts), 'Drafts with banned wording', 'Prices, promises, or safety advice; a simple scan can miss things')
  );
  const savedIds = new Set((Array.isArray(results.cases) ? results.cases : []).map(item => item?.id));
  const harder = Object.keys(HARDER_CASES).filter(id => savedIds.has(id));
  $('case-chips').replaceChildren(...harder.map(id => {
    const chip = document.createElement('a');
    chip.className = 'case-chip'; chip.href = 'dashboard.html?case=' + id; chip.textContent = HARDER_CASES[id];
    return chip;
  }));
  $('hard-cases').hidden = !harder.length;
}

/* ---- Time worksheet (details.html) ---- */
function calculate() {
  const ids = { requests: 'requests', manual: 'manual', assisted: 'assisted', maintenance: 'maintenance', setup: 'setup', rate: 'rate', tools: 'tool-spend' };
  const values = {}; const problems = []; let valid = true;
  for (const [name, id] of Object.entries(ids)) {
    const input = $(id);
    const ok = input.value.trim() !== '' && input.checkValidity() && Number.isFinite(Number(input.value));
    input.setAttribute('aria-invalid', String(!ok)); valid = valid && ok; values[name] = Number(input.value);
    if (!ok) problems.push(input.labels[0].textContent.trim() + ': enter a number from ' + input.min + ' to ' + input.max + ', in increments of ' + input.step + '.');
  }
  const answer = valid ? window.ProposalValue.estimate(values) : null;
  $('value-error').hidden = Boolean(answer);
  $('value-error').textContent = problems.join(' ') || 'Check the highlighted values before calculating this scenario.';
  const number = value => value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  const shown = answer
    ? { 'hours': number(answer.hours), 'first-month': number(answer.firstMonth), 'capacity-value': money(answer.capacity), 'net-value': money(answer.netValue) }
    : { 'hours': '—', 'first-month': '—', 'capacity-value': '—', 'net-value': '—' };
  for (const [id, text] of Object.entries(shown)) $(id).textContent = text;
  $('value-formula').textContent = answer ? values.requests + ' requests × (' + values.manual + ' − ' + values.assisted + ') minutes × 52 ÷ 12 ÷ 60 − ' + values.maintenance + ' maintenance hours per month.' : 'Correct the highlighted input to calculate this scenario.';
}

async function copyText(text, status, success) {
  try { await navigator.clipboard.writeText(text); status.textContent = success; }
  catch { status.textContent = 'Copy is unavailable. Select and copy this text: ' + text; }
}

if ($('eval-grid')) renderResults();
if ($('value-form')) {
  calculate();
  $('value-form').addEventListener('input', calculate);
  $('value-form').addEventListener('submit', event => event.preventDefault());
}
if ($('share')) {
  $('share').addEventListener('click', () => {
    if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) { $('share-status').textContent = 'This is a local preview. Use the published proposal address after release.'; return; }
    copyText(location.origin + location.pathname, $('share-status'), 'Proposal link copied.');
  });
}
