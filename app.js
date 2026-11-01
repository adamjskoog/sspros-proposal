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
  C25: 'Emergency written in Spanish', C26: 'Emergency buried in a quote request', C34: 'Prompt injection: a fake price',
  C36: 'Injection inside an out-of-scope request', C19: 'Near miss: a tripping breaker', C37: 'Vague: “Need an electrician.”'
};
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
  const verdict = item.passed ? 'Passed every check in the evaluation.' : 'Flagged by the grader for review.';
  return {
    title: SHOWCASE_TITLES[item.id] || item.id, message: '“' + item.inquiry + '”',
    service: h.service_summary, location: h.location || 'Not provided', timing: h.timing || 'Not provided',
    owner: ROUTE_LABELS[h.route] || h.route, action: h.next_action, draft: h.draft_reply,
    review: [h.reviewer_notes, verdict].filter(Boolean).join(' '), badge, urgent: h.route === 'human_escalation'
  };
}

const showcaseOrder = Object.keys(SHOWCASE_TITLES);
const samples = results && results.showcase && results.showcase.length
  ? Object.fromEntries([...results.showcase]
      .sort((a, b) => showcaseOrder.indexOf(a.id) - showcaseOrder.indexOf(b.id))
      .map(item => [item.id, fromEval(item)]))
  : presets;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function setupDemo() {
  if (samples === presets) return;
  const select = $('scenario');
  select.replaceChildren(...Object.entries(samples).map(([id, sample]) => new Option(sample.title, id)));
  $('demo-mode').textContent = 'Real model output';
  $('demo-source').textContent = 'Recorded from the evaluation run · ' + formatDate(results.meta.run_at);
  $('demo-intro').textContent = 'These are actual outputs from the evaluation run, not scripted examples. Pick a hard case and see the handoff the model produced.';
  $('sample-note').textContent = 'Model: ' + results.meta.model + '. Output shown exactly as returned and graded.';
}

function resetDemo() {
  const sample = samples[$('scenario').value];
  $('sample-title').textContent = sample.title;
  $('sample-message').textContent = sample.message;
  $('demo-empty').hidden = false;
  $('demo-result').hidden = true;
  $('prepare').innerHTML = 'Prepare the handoff <span aria-hidden="true">→</span>';
  $('copy-status').textContent = '';
}

function showHandoff() {
  const sample = samples[$('scenario').value];
  for (const key of ['service', 'location', 'timing', 'owner', 'action', 'review']) $('result-' + key).textContent = sample[key];
  const hasDraft = Boolean(sample.draft);
  $('result-draft').textContent = hasDraft ? sample.draft : 'No customer reply is drafted for this route. A person handles it directly.';
  $('draft-label').textContent = hasDraft ? 'RESPONSE DRAFT · NOT SENT' : 'NO AUTOMATED REPLY';
  $('copy-draft').hidden = !hasDraft;
  $('review-badge').textContent = sample.badge;
  $('review-badge').classList.toggle('urgent', sample.urgent);
  $('demo-empty').hidden = true;
  $('demo-result').hidden = false;
  $('prepare').innerHTML = 'Handoff prepared <span aria-hidden="true">✓</span>';
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
  $('eval-meta').textContent = s.cases + ' practice inquiries I wrote, each checked against the right answer · run ' +
    formatDate(results.meta.run_at);
  $('eval-grid').replaceChildren(
    metricCard(ratio(s.emergency_recall), 'Emergencies sent to a person', 'Danger always goes to a human'),
    metricCard(String(s.unsafe_drafts), 'Unsafe replies', 'No made-up prices or promises'),
    metricCard(ratio(s.all_checks_passed), 'Messages handled correctly', 'Sorted, details found, reply drafted')
  );
}

async function copyText(text, status, success) {
  try { await navigator.clipboard.writeText(text); status.textContent = success; }
  catch { status.textContent = 'Copy is unavailable in this browser. Select and copy the text shown here: ' + text; }
}

function calculate() {
  const requests = $('requests'), minutes = $('minutes');
  const valid = requests.checkValidity() && minutes.checkValidity();
  $('value-error').hidden = valid;
  requests.setAttribute('aria-invalid', String(!requests.checkValidity()));
  minutes.setAttribute('aria-invalid', String(!minutes.checkValidity()));
  if (!valid) {
    $('hours').textContent = '—';
    $('value-formula').textContent = 'Update the assumptions to calculate a scenario.';
    $('value-cost').hidden = true;
    return;
  }
  const r = Number(requests.value), m = Number(minutes.value);
  $('hours').textContent = (r * m * 4 / 60).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $('value-formula').textContent = r + ' requests × ' + m + ' minutes × 4 weeks ÷ 60';
  if (results) {
    const perInquiry = results.summary.cost_usd.per_inquiry;
    $('value-cost').hidden = false;
    $('value-cost').textContent = 'AI cost at $' + perInquiry.toFixed(4) + ' per inquiry (API prices, measured tokens): about $' +
      (r * 4 * perInquiry).toFixed(2) + ' per 4 weeks.';
  }
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
