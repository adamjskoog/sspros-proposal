'use strict';
/* Shared by index.html (example demo, sharing) and details.html (test results, worksheet).
   Each feature runs only when its elements are on the page. */
const $ = id => document.getElementById(id);
const results = window.EVAL_RESULTS || null;

/* Written examples, used only when the saved AI answers are unavailable. */
const presets = {
  commercial: {
    title: 'Commercial build-out',
    message: '“We’re planning an office build-out in Tampa and need help with power and data cabling. We’re aiming for next quarter. We can share the floor plan. Email is best.”',
    service: 'Commercial electrical + cabling', location: 'Tampa', timing: 'Next quarter', owner: 'Estimator',
    action: 'Confirm coverage, request the floor plan, and assign an estimator.',
    draft: 'Thanks for reaching out about your office build-out. Could you share the floor plan and your target dates? Our team will review the power and cabling scope and follow up with next steps.',
    review: 'A person confirms scope and wording before anything is sent. No price or availability is promised.', badge: 'Team review needed', urgent: false
  },
  missing: {
    title: 'Request with missing details', message: '“I’m interested in getting a generator installed at my house. Can you send me a price?”',
    service: 'Home standby generator', location: 'Not provided', timing: 'Not provided', owner: 'Office',
    action: 'Ask for the project city and timing. Pricing questions go to the estimator.',
    draft: 'Thanks for your interest in a generator installation. What city is the home in, and what timing do you have in mind? The team can then review what is needed for an estimate.',
    review: 'Missing details stay visible. A person must check facts, prices, and any scheduling language.', badge: 'More details needed', urgent: false
  },
  urgent: {
    title: 'Urgent electrical concern', message: '“There’s a burning smell near the electrical panel at our property. Can someone come today?”',
    service: 'Reported hazard at a panel', location: 'Not provided', timing: 'Today', owner: 'A person, right away',
    action: 'Follow the company’s emergency procedure. Do not place in the estimate queue.',
    draft: null,
    review: 'No automatic reply, troubleshooting, or safety advice is produced for hazards.', badge: 'Sent to a person', urgent: true
  }
};

const CASE_TITLES = {
  C01: 'Commercial build-out', C18: 'Request with missing details', C21: 'Urgent electrical concern',
  C25: 'Emergency written in Spanish', C26: 'Emergency within a quote request',
  C34: 'Attempt to insert a fake price', C36: 'Instructions hidden in an off-topic request',
  C19: 'Request about a tripping breaker', C37: 'Request with almost no detail'
};
const MAIN_CASES = ['C01', 'C18', 'C21'];
const ROUTES = { estimator: 'Estimator', office_intake: 'Office', human_escalation: 'A person, right away', out_of_scope: 'Office (not our type of work)', spam: 'Spam check' };
const FIELD_LABELS = { location: 'location', timing: 'timing', property_type: 'home or business', scope_details: 'what work is needed' };
function fromEval(item) {
  const h = item.handoff;
  return {
    title: CASE_TITLES[item.id], message: '“' + item.inquiry + '”', service: h.service_summary,
    location: h.location || 'Not provided', timing: h.timing || 'Not provided', owner: ROUTES[h.route] || h.route,
    action: h.next_action, draft: h.draft_reply,
    missing: h.missing_fields.length ? h.missing_fields.map(field => FIELD_LABELS[field] || field).join(', ') : 'Nothing',
    review: [h.reviewer_notes, item.passed ? 'Passed the automatic checks. A person still reviews it.' : 'Some automatic checks failed on this answer. A person would need to correct it.'].filter(Boolean).join('\n\n'),
    badge: h.route === 'human_escalation' ? 'Sent to a person' : h.missing_fields.length ? 'More details needed' : 'Team review needed',
    urgent: h.route === 'human_escalation'
  };
}
const available = new Map((Array.isArray(results?.cases) ? results.cases : []).filter(item => item?.handoff && Array.isArray(item.handoff.missing_fields)).map(item => [item.id, item]));
const recorded = Object.fromEntries(Object.keys(CASE_TITLES).filter(id => available.has(id)).map(id => [id, fromEval(available.get(id))]));
const samples = Object.keys(recorded).length ? recorded : presets;
const isRecorded = samples === recorded;
const dateLabel = iso => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/* ---- Example demo (index.html) ---- */
function setupDemo() {
  $('scenario').replaceChildren(...Object.entries(samples).map(([id, sample]) => new Option(sample.title, id)));
  if (isRecorded) {
    $('demo-mode').textContent = 'Saved AI answers';
    $('demo-source').textContent = 'Made-up messages · saved ' + dateLabel(results.meta.run_at) + ' · nothing is sent';
    $('sample-note').textContent = 'This is the answer the AI gave when I tested it, not a live request.';
  } else {
    $('demo-mode').textContent = 'Written examples';
    $('demo-source').textContent = 'Saved answers unavailable · written examples only';
    $('sample-note').textContent = 'This is a written example, not a saved AI answer.';
  }
  const requested = new URLSearchParams(location.search).get('case');
  if (requested && samples[requested]) $('scenario').value = requested;
}
function render() {
  const id = $('scenario').value;
  const sample = samples[id];
  $('sample-title').textContent = sample.title;
  $('sample-message').textContent = sample.message;
  for (const key of ['service', 'location', 'timing', 'owner', 'action', 'review']) $('result-' + key).textContent = sample[key];
  const hasDraft = Boolean(sample.draft);
  $('result-draft').textContent = hasDraft ? sample.draft : 'No reply was drafted. A person handles this one directly.';
  $('draft-label').textContent = !hasDraft ? 'No automatic reply' : isRecorded ? 'Saved draft · not sent' : 'Example draft · not sent';
  $('result-missing').textContent = 'Still needed from the customer: ' + (sample.missing || 'see the next step.');
  $('copy-draft').hidden = !hasDraft;
  $('copy-status').textContent = '';
  $('review-badge').textContent = sample.badge;
  $('review-badge').classList.toggle('urgent', sample.urgent);
  $('review-example').hidden = id !== (isRecorded ? 'C01' : 'commercial');
}

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
  const harder = Object.keys(recorded).filter(id => !MAIN_CASES.includes(id));
  $('case-chips').replaceChildren(...harder.map(id => {
    const chip = document.createElement('a');
    chip.className = 'case-chip'; chip.href = 'index.html?case=' + id + '#work-sample'; chip.textContent = CASE_TITLES[id];
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

if ($('scenario')) {
  setupDemo(); render();
  $('scenario').addEventListener('change', render);
  $('copy-draft').addEventListener('click', () => copyText($('result-draft').textContent, $('copy-status'), 'Copied. Nothing has been sent.'));
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
