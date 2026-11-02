'use strict';
const $ = id => document.getElementById(id);
const results = window.EVAL_RESULTS || null;

/* Preset examples, used only until a real evaluation run is published. */
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
    service: 'Home standby generator', location: 'Not provided', timing: 'Not provided', owner: 'Office intake',
    action: 'Ask for the project city and timing. Pricing questions go to the estimator.',
    draft: 'Thanks for your interest in a generator installation. What city is the home in, and what timing do you have in mind? The team can then review what is needed for an estimate.',
    review: 'Missing details stay visible. The workflow never invents a location, price, or appointment.', badge: 'More details needed', urgent: false
  },
  urgent: {
    title: 'Urgent electrical concern', message: '“There’s a burning smell near the electrical panel at our property. Can someone come today?”',
    service: 'Reported hazard at a panel', location: 'Not provided', timing: 'Today', owner: 'Person, immediately',
    action: 'Escalate through the company’s urgent-contact procedure. Do not place in the estimate queue.',
    draft: null,
    review: 'No automated reply, troubleshooting, or safety advice is produced for hazards.', badge: 'Human escalation', urgent: true
  }
};

const SHOWCASE_TITLES = {
  C25: 'Emergency written in Spanish', C26: 'Emergency buried in a quote request', C34: 'Trick message asking for a fake price',
  C36: 'Trick hidden in an off-topic request', C19: 'Breaker that keeps tripping', C37: 'Too vague: “Need an electrician.”'
};
const SAMPLE_TITLES = { C01: 'Commercial build-out', C06: 'Request with missing details', ...SHOWCASE_TITLES };
const ROUTE_LABELS = {
  estimator: 'Estimator', office_intake: 'Office intake', human_escalation: 'Person, immediately',
  out_of_scope: 'Polite decline', spam: 'No reply (spam)'
};

function fromEval(item) {
  const h = item.handoff;
  const badge = h.route === 'human_escalation' ? 'Human escalation'
    : h.route === 'spam' ? 'Spam · no reply'
    : h.route === 'out_of_scope' ? 'Polite decline'
    : h.missing_fields.length ? 'More details needed' : 'Team review needed';
  const verdict = item.passed ? 'Passed every check in the practice test.' : 'The practice test flagged this one for a closer look.';
  return {
    title: SAMPLE_TITLES[item.id] || item.id, message: '“' + item.inquiry + '”',
    service: h.service_summary, location: h.location || 'Not provided', timing: h.timing || 'Not provided',
    owner: ROUTE_LABELS[h.route] || h.route, action: h.next_action, draft: h.draft_reply,
    review: [h.reviewer_notes, verdict].filter(Boolean).join(' '), badge, urgent: h.route === 'human_escalation'
  };
}

const showcaseOrder = Object.keys(SAMPLE_TITLES);
const recordedCases = results ? (results.cases || results.showcase || []).filter(item => SAMPLE_TITLES[item.id] && item.handoff) : [];
const samples = recordedCases.length
  ? Object.fromEntries([...recordedCases]
      .sort((a, b) => showcaseOrder.indexOf(a.id) - showcaseOrder.indexOf(b.id))
      .map(item => [item.id, fromEval(item)]))
  : presets;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function setupDemo() {
  if (samples === presets) {
    $('demo-mode').textContent = 'Illustrative examples';
    $('demo-source').textContent = 'Preset examples · recorded evaluation unavailable';
    $('demo-intro').textContent = 'These preset examples illustrate the handoff. Recorded AI results are unavailable in this copy of the site.';
    $('sample-note').textContent = 'Manually prepared example, not an AI result.';
    return;
  }
  const select = $('scenario');
  select.replaceChildren(...Object.entries(samples).map(([id, sample]) => new Option(sample.title, id)));
  $('demo-mode').textContent = 'Saved AI results';
  $('demo-source').textContent = 'Saved from the practice test · ' + formatDate(results.meta.run_at);
  $('demo-intro').textContent = 'Start with an ordinary request, then try the harder ones. Each result is exactly what the AI wrote for a made-up email. Job titles such as “Estimator” are examples of who might receive it.';
  $('sample-note').textContent = 'Shown exactly as the AI wrote it during testing (AI model: ' + results.meta.model + ').';
}

function resetDemo() {
  const sample = samples[$('scenario').value];
  $('sample-title').textContent = sample.title;
  $('sample-message').textContent = sample.message;
  $('demo-empty').hidden = false;
  $('demo-result').hidden = true;
  $('prepare').textContent = samples === presets ? 'View example handoff →' : 'View saved AI result →';
  $('prepare').setAttribute('aria-expanded', 'false');
  $('copy-status').textContent = '';
}

function showHandoff() {
  const sample = samples[$('scenario').value];
  for (const key of ['service', 'location', 'timing', 'owner', 'action', 'review']) $('result-' + key).textContent = sample[key];
  const hasDraft = Boolean(sample.draft);
  $('result-draft').textContent = hasDraft ? sample.draft : 'No customer reply is drafted for this route. A person handles it directly.';
  $('draft-label').textContent = hasDraft ? 'DRAFT REPLY · NOT SENT' : 'NO AUTOMATED REPLY';
  $('copy-draft').hidden = !hasDraft;
  $('review-badge').textContent = sample.badge;
  $('review-badge').classList.toggle('urgent', sample.urgent);
  $('demo-empty').hidden = true;
  $('demo-result').hidden = false;
  $('prepare').textContent = samples === presets ? 'Example handoff shown ✓' : 'Saved AI result shown ✓';
  $('prepare').setAttribute('aria-expanded', 'true');
  $('copy-status').textContent = '';
}

function metricCard(value, label, note) {
  const card = document.createElement('div');
  card.className = 'eval-metric';
  const strong = document.createElement('strong');
  strong.textContent = value;
  const span = document.createElement('span');
  span.textContent = label;
  card.append(strong, span);
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    card.append(small);
  }
  return card;
}

function ratio(metric) {
  return metric.passed + '/' + metric.total;
}

function percent(metric) {
  return metric.total ? Math.round((metric.passed / metric.total) * 100) + '%' : '—';
}

function renderResults() {
  if (!results) return;
  const s = results.summary;
  $('eval-meta').textContent = s.cases + ' made-up customer emails, each checked against the right answer · tested ' +
    formatDate(results.meta.run_at);
  const cards = [
    metricCard(ratio(s.all_checks_passed), 'Passed every check', 'Right person, right details, reply within the rules'),
    metricCard(ratio(s.emergency_recall), 'Emergencies sent straight to a person', 'All six test emergencies'),
    metricCard(String(s.unsafe_drafts), 'Replies flagged as a problem', 'An automatic check. A person still reads every reply.')
  ];
  if (s.cost_usd && s.latency_s) {
    const cents = Math.max(1, Math.round(s.cost_usd.per_inquiry * 100));
    cards.push(metricCard('≈' + cents + '¢', 'AI cost per email, pay-per-use rate', 'For comparison only · about ' + Math.round(s.latency_s.p50) + ' seconds'));
  }
  $('eval-grid').replaceChildren(...cards);
  renderHardCases();
}

function renderHardCases() {
  const ids = Object.keys(samples).filter(id => SHOWCASE_TITLES[id]);
  if (!ids.length) return;
  $('case-chips').replaceChildren(...ids.map(id => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'case-chip';
    chip.textContent = SHOWCASE_TITLES[id];
    chip.addEventListener('click', () => openCase(id));
    return chip;
  }));
  $('hard-cases').hidden = false;
}

function openCase(id) {
  $('scenario').value = id;
  resetDemo();
  showHandoff();
  $('work-sample').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  $('scenario').focus({ preventScroll: true });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function copyText(text, status, success) {
  try { await navigator.clipboard.writeText(text); status.textContent = success; }
  catch { status.textContent = 'Copy is unavailable in this browser. Select and copy the text shown here: ' + text; }
}

const usd = digits => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits });
const estimateFields = ['requests', 'saved', 'review', 'corrections', 'maintenance', 'setup', 'rate'];
const number = value => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

function calculate() {
  const invalid = [];
  const values = Object.fromEntries(estimateFields.map(id => {
    const input = $(id);
    const valid = input.value.trim() !== '' && input.checkValidity() && Number.isFinite(Number(input.value));
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) invalid.push(input);
    return [id, Number(input.value)];
  }));
  $('value-error').hidden = invalid.length === 0;
  if (invalid.length) {
    $('value-error').textContent = invalid.map(input => input.labels[0].textContent + ': enter ' + input.min + '–' + input.max + ' in steps of ' + input.step + '.').join(' ');
    for (const id of ['hours', 'net-minutes', 'hours-year', 'value-year', 'ai-year']) $(id).textContent = '—';
    $('hours-label').textContent = 'estimate unavailable';
    $('value-direction').textContent = 'Correct the highlighted fields to recalculate.';
    $('value-formula').textContent = '';
    return;
  }
  const perInquiry = results?.summary?.cost_usd?.per_inquiry ?? null;
  const estimate = calculateTimeEstimate(values, perInquiry);
  $('hours').textContent = number(estimate.firstYearHours);
  $('hours-label').textContent = 'net hours freed in year one';
  $('value-direction').textContent = estimate.firstYearHours < 0
    ? 'This scenario adds ' + number(Math.abs(estimate.firstYearHours)) + ' hours of work in year one. Negative values mean extra work.'
    : estimate.firstYearHours === 0 ? 'This scenario breaks even on staff time in year one.'
    : 'After review, corrections, maintenance, and setup. Positive values mean time freed.';
  $('net-minutes').textContent = number(estimate.netMinutes) + ' min';
  $('hours-year').textContent = number(estimate.ongoingHours) + ' hours';
  $('value-year').textContent = usd(0).format(estimate.timeValue);
  $('ai-year').textContent = estimate.modelCost === null ? 'Not available' : usd(2).format(estimate.modelCost);
  $('value-formula').textContent = 'Year one: ' + values.requests + ' requests × (' + values.saved + ' − ' + values.review + ' − ' + values.corrections + ') min × 52 weeks ÷ 60 − ' + values.maintenance + ' hours × 12 months − ' + values.setup + ' setup hours.';
}

setupDemo();
resetDemo();
renderResults();
calculate();
$('scenario').addEventListener('change', resetDemo);
$('prepare').addEventListener('click', showHandoff);
$('copy-draft').addEventListener('click', () => copyText($('result-draft').textContent, $('copy-status'), 'Copied. Nothing has been sent.'));
$('share').addEventListener('click', () => {
  if (location.protocol === 'file:') {
    $('share-status').textContent = 'This is a local preview. Open the published website to copy a shareable link.';
    return;
  }
  copyText(location.href.split('#')[0], $('share-status'), 'Proposal link copied. Ready to share.');
});
$('value-form').addEventListener('input', calculate);
$('value-form').addEventListener('submit', e => e.preventDefault());
