/* Example data for dashboard.html. Website messages marked `saved` use the AI's recorded
   answers from eval-results.js; everything else is a written example. All people are made up. */
(function (scope) {
  'use strict';

  const LANES = {
    urgent: { name: 'Needs a person now', short: 'Urgent', helper: 'Safety check + AI', decides: 'calls back right away', person: 'oncall' },
    electrical: { name: 'Electrical', short: 'Electrical', helper: 'AI estimating helper', decides: 'decides on the job', person: 'estimator' },
    comms: { name: 'Communications', short: 'Office', helper: 'AI communications helper', decides: 'approves every reply', person: 'office' },
    web: { name: 'Website', short: 'Website', helper: 'AI web helper', decides: 'fixes it; the owner approves', person: 'adam' }
  };

  const TEAM = [
    { id: 'oncall', name: 'On-call lead', role: 'Emergencies' },
    { id: 'estimator', name: 'Sam', role: 'Estimator' },
    { id: 'office', name: 'Alex', role: 'Office' },
    { id: 'adam', name: 'Adam', role: 'Website & AI tools' },
    { id: 'owner', name: 'Owner', role: 'Final say' }
  ];

  const STATUSES = {
    new: 'New',
    waiting_us: 'Waiting on us',
    waiting_customer: 'Waiting on customer',
    done: 'Done'
  };

  const SOURCES = { website: 'Website', email: 'Email', phone: 'Phone', text: 'Text' };

  /* Saved AI answers: titles and timing added here; content comes from the recorded run. */
  const SAVED = [
    { id: 'C21', title: 'Burning smell at the panel', minutesAgo: 6, from: 'Website form' },
    { id: 'C25', title: 'Burning smell (message in Spanish)', minutesAgo: 22, from: 'Website form' },
    { id: 'C26', title: 'EV charger quote, plus a hot panel', minutesAgo: 41, from: 'Website form' },
    { id: 'C01', title: 'Office build-out in Tampa', minutesAgo: 75, from: 'Website form' },
    { id: 'C34', title: 'Two garage circuits (fake price inside)', minutesAgo: 130, from: 'Website form' },
    { id: 'C18', title: 'Generator price question', minutesAgo: 95, from: 'Website form', status: 'waiting_customer' },
    { id: 'C37', title: '“Need an electrician.”', minutesAgo: 160, from: 'Website form' },
    { id: 'C36', title: 'Water heater leak (not our work)', minutesAgo: 210, from: 'Website form', status: 'done' }
  ];

  const WRITTEN = [
    { id: 'P1', source: 'phone', lane: 'urgent', status: 'new', minutesAgo: 3, from: 'Voicemail · Oak Street Dental',
      title: 'Outlet sparked, breaker won’t reset',
      message: 'Hi, this is the manager at the Oak Street dental office. One of the outlets in the back sparked and now the breaker won’t reset. Half the exam rooms have no power. Please call me back as soon as you can.',
      service: 'Sparking outlet; partial power loss at a business', location: 'Oak Street Dental (city not given)', timing: 'Now', missing: ['city'],
      next: 'URGENT: the on-call lead calls back right away. No reply by text or email.', draft: null,
      notes: 'Hazard word: “sparked.” A business is losing power. A person handles this directly.' },
    { id: 'P2', source: 'phone', lane: 'comms', status: 'new', minutesAgo: 55, from: 'Voicemail · Dana R.',
      title: 'Thinks an invoice was charged twice',
      message: 'Hi, it’s Dana. I think my card was charged twice for invoice 1042 from the fan install last week. Can someone take a look and call me back?',
      service: 'Billing question on a finished job', location: 'On file', timing: 'This week', missing: [],
      next: 'Office checks the payment record and calls Dana back. The AI does not touch billing.',
      draft: 'Hi Dana, thanks for letting us know. We’re checking the payment for invoice 1042 now and will call you back today.',
      notes: 'Billing stays with the office.' },
    { id: 'E1', source: 'email', lane: 'electrical', status: 'new', minutesAgo: 18, from: 'Email · Bayline Builders (GC)',
      title: 'Bid invite: medical office fit-out',
      message: 'We’re bidding a 6,000 sq ft medical office fit-out in Lakeland and would like your electrical and low-voltage price. Plans and specs are attached. Bids are due January 15.',
      service: 'Commercial fit-out bid: electrical and low voltage', location: 'Lakeland', timing: 'Bids due January 15', missing: [],
      next: 'Estimator reviews the plans and decides whether to bid. Add the due date to the bid calendar.',
      draft: 'Thanks for the invitation. We’ve received the plans, and our estimator will review them. We’ll confirm shortly whether we’ll submit a bid.',
      notes: 'The AI does not decide whether to bid or give any price.' },
    { id: 'E2', source: 'email', lane: 'electrical', status: 'waiting_us', minutesAgo: 300, from: 'Email · Chris P.',
      title: 'Ready to schedule the panel upgrade',
      message: 'We got your quote for the 200-amp panel upgrade at our house in Riverview and we’d like to go ahead. What dates do you have in the next few weeks?',
      service: 'Accepted quote: 200-amp residential panel upgrade', location: 'Riverview', timing: 'Next few weeks', missing: [],
      next: 'Estimator confirms the quote is current; office offers install dates.',
      draft: 'Great news, thank you! We’ll confirm the details of your quote and get back to you with available dates.',
      notes: 'Accepted work. Don’t let this one sit.' },
    { id: 'T1', source: 'text', lane: 'comms', status: 'new', minutesAgo: 12, from: 'Text · Maria G.',
      title: 'Can you come Thursday instead?',
      message: 'Hi it’s Maria. You’re scheduled Wednesday for the ceiling fans. Any chance Thursday works instead? Same time.',
      service: 'Reschedule an existing job (ceiling fans)', location: 'On file', timing: 'Move Wednesday to Thursday', missing: [],
      next: 'Office checks Thursday with the crew and confirms. The AI does not change the schedule.',
      draft: 'Hi Maria, thanks for letting us know. Let me check Thursday with the crew, and I’ll confirm shortly.',
      notes: 'Existing customer. Scheduling stays with the office.' },
    { id: 'T2', source: 'text', lane: 'comms', status: 'done', minutesAgo: 240, from: 'Text · Ken L.',
      title: '“Lights look great, thank you!”',
      message: 'Just wanted to say the new lights in the shop look great. Your guys were quick and clean. Thank you!',
      service: 'Happy customer after a finished job', location: 'On file', timing: 'None', missing: [],
      next: 'Office thanks Ken and asks if he’d leave a Google review.',
      draft: 'Thanks so much, Ken! We’re glad you’re happy with them. If you have a minute, a Google review would mean a lot to our team.',
      notes: 'A good moment to ask for a review.' },
    { id: 'W1', source: 'website', lane: 'web', status: 'new', minutesAgo: 34, from: 'Website form',
      title: 'Contact form stuck on a phone',
      message: 'I tried to send a request from my phone and the page just spun. Ended up calling instead. Just so you know.',
      service: 'Website problem: contact form on phones', location: 'Not needed', timing: 'Soon; customers may be giving up', missing: [],
      next: 'Adam tests the form on several phones, fixes it, and shows the owner before it goes live.',
      draft: 'Thank you for telling us, and sorry for the trouble. We’re looking into the form now.',
      notes: 'Possible lost requests. Worth checking today.' },
    { id: 'W2', source: 'email', lane: 'web', status: 'waiting_us', minutesAgo: 190, from: 'Email · a customer',
      title: 'Google listing shows old hours',
      message: 'Your Google listing says you close at 4, but your website says 5. Which is right?',
      service: 'Business hours don’t match online', location: 'Not needed', timing: 'This week', missing: [],
      next: 'Adam confirms the correct hours with the owner, then updates Google and the website to match.',
      draft: 'Thanks for catching that. We’re confirming our hours and will update both listings.',
      notes: 'The owner confirms the hours before anything changes.' },
    { id: 'W3', source: 'text', lane: 'web', status: 'new', minutesAgo: 80, from: 'Text · Owner',
      title: 'Add the Brandon project photos',
      message: 'Got great photos of the Brandon warehouse job. Can we get them on the website?',
      service: 'New project photos for the website', location: 'Brandon', timing: 'When ready', missing: ['customer’s OK to show the job'],
      next: 'Adam picks the best photos, checks the customer is happy to be shown, and sends the owner a preview.', draft: null,
      notes: 'Internal request. No customer reply needed.' }
  ];

  const data = { LANES, TEAM, STATUSES, SOURCES, SAVED, WRITTEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else scope.DashboardData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
