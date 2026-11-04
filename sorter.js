/* Transparent keyword rules used by the example dashboard's "New message" form.
   In the real system the tested AI reads each message; this safety check would still run,
   so a message mentioning a hazard reaches a person even if the AI misreads it. */
(function (scope) {
  'use strict';

  const HAZARD = [
    ['burning', /\bburn(ing|t)?\b/i], ['smoke', /\bsmok(e|ing|y)\b/i], ['sparks', /\bspark(s|ed|ing)?\b/i],
    ['crackling', /\bcrackl(e|es|ed|ing)\b/i], ['shock', /\b(shock(ed)?|electrocut\w*)\b/i],
    ['hot to the touch', /\b(too hot|hot to the touch|melt(ed|ing)?|scorch(ed)?)\b/i],
    ['exposed or downed wires', /\b(exposed|downed|bare|hanging) (live )?wires?\b/i],
    ['water near electrical', /\bwater\b.{0,40}\b(panel|outlet|breaker|wiring|meter)\b|\b(panel|outlet|breaker|wiring|meter)\b.{0,40}\bwater\b/i],
    ['fire', /\bfire\b/i], ['quemado (burning)', /\bquemad[oa]\b/i], ['humo (smoke)', /\bhumo\b/i], ['chispas (sparks)', /\bchispa(s)?\b/i]
  ];
  const WEBSITE = /\b(website|web site|web ?page|contact form|the form|google|listing|link|photos?|reviews?|online)\b/i;
  const ELECTRICAL = /\b(quote|bid|estimate|pricing|build-?out|fit-?out|tenant improvement|panel|circuits?|outlets?|wiring|rewire|lighting|lights|fixtures?|fans?|generators?|ev charger|charger|cabling|network|cameras?|access control|service upgrade|plans|specs|install(ation)?)\b/i;
  const PLACES = /\b(tampa|orlando|lakeland|brandon|kissimmee|clearwater|st\.? petersburg|sarasota|largo|riverview|wesley chapel|winter haven|plant city|sanford|ocala|bradenton|palm harbor|dunedin|new port richey)\b/i;
  const ZIP = /\b3[2-4]\d{3}\b/;
  const TIMING = /\b(today|tonight|tomorrow|asap|urgent|this week|next week|this month|next month|next quarter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d+ (days?|weeks?|months?)|soon|by the|deadline|due)\b/i;

  function titleFrom(text) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const short = words.slice(0, 7).join(' ');
    return words.length > 7 ? short + '…' : short;
  }

  function sortMessage(input) {
    const text = String(input == null ? '' : input).trim();
    if (!text) return null;
    const hazards = HAZARD.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
    const missing = [];
    if (!PLACES.test(text) && !ZIP.test(text)) missing.push('location');
    if (!TIMING.test(text)) missing.push('timing');
    let lane; const reasons = [];
    if (hazards.length) {
      lane = 'urgent';
      reasons.push('Mentions ' + hazards.map(h => '“' + h + '”').join(', ') + '. Possible hazard, so a person calls back.');
    } else if (WEBSITE.test(text) && !ELECTRICAL.test(text)) {
      lane = 'web';
      reasons.push('Mentions the website or online listings.');
    } else if (ELECTRICAL.test(text) && !missing.includes('location')) {
      lane = 'electrical';
      reasons.push('Describes electrical work and says where. Ready for the estimator.');
    } else {
      lane = 'comms';
      reasons.push(ELECTRICAL.test(text) ? 'Describes electrical work but is missing details. The office asks for them first.' : 'General question for the office.');
    }
    if (lane === 'web') missing.length = 0; // website issues don't need a job location or timing
    const asks = missing.map(field => field === 'location' ? 'what city or ZIP code the job is in' : 'when you’re hoping to have the work done');
    const draft = lane === 'urgent' ? null
      : asks.length ? 'Thanks for reaching out to System Solutions Pros. So we can help, could you tell us ' + asks.join(' and ') + '? We’ll follow up with next steps.'
      : 'Thanks for reaching out to System Solutions Pros. We’ve received your message, and the right person on our team will follow up with next steps.';
    return { title: titleFrom(text), lane, urgent: lane === 'urgent', hazards, missing, reasons, draft };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { sortMessage };
  else scope.TriageSorter = { sortMessage };
})(typeof globalThis !== 'undefined' ? globalThis : this);
