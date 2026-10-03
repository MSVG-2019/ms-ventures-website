'use strict';
// A review model, not an authorization service. No live guest data or credentials.
(function (root) {
  const states = Object.freeze({
    booking: ['confirmed', 'cancelled', 'moved', 'unknown'],
    payment: ['paid', 'pending', 'failed', 'refund_review', 'unknown'],
    link: ['available', 'expired', 'unavailable'],
    channel: ['direct', 'airbnb', 'booking'],
    card: ['not_requested', 'requested', 'issued', 'delivered', 'needs_resend'],
    eligibility: ['confirmed', 'unknown', 'not_eligible'],
    arrival: ['withheld', 'available', 'needs_help', 'unknown']
  });
  const minor = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;
  const identifier = value => typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value);
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function exactKeys(value, allowed) {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'A review record must be an object.');
    const keys = Object.keys(value);
    assert(keys.length === allowed.length && keys.every(key => allowed.includes(key)), 'Unexpected or missing review fields.');
  }
  function taxStatement(stay) {
    validateStay(stay);
    const tax = stay.tax;
    exactKeys(tax, ['priorCollectionConfirmed','components','allocations']);
    assert(tax && Array.isArray(tax.components) && tax.components.length === 2 && Array.isArray(tax.allocations), 'Invalid tax statement.');
    assert(tax.allocations.length <= 100, 'Too many allocation records.');
    const keys = tax.components.map(c => c.key);
    assert(new Set(keys).size === 2 && keys.includes('regional') && keys.includes('communal'), 'Two distinct tax components are required.');
    const issues = [];
    const components = tax.components.map(c => {
      exactKeys(c, ['key','revision','rateMinor','nights','chargeableGuests','assessedMinor','confirmed','exemptionConfirmed']);
      assert(minor(c.assessedMinor) && minor(c.rateMinor) && Number.isSafeInteger(c.nights) && c.nights > 0 && c.nights <= 366 && Number.isSafeInteger(c.chargeableGuests) && c.chargeableGuests >= 0 && c.chargeableGuests <= 100, 'Invalid tax quantities.');
      assert(c.chargeableGuests <= stay.registration.required && c.nights === tax.components[0].nights, 'Tax basis contradicts the sample stay.');
      assert(typeof c.confirmed === 'boolean' && typeof c.exemptionConfirmed === 'boolean' && identifier(c.revision), 'Missing assessment evidence.');
      if (!c.confirmed || c.rateMinor * c.nights * c.chargeableGuests !== c.assessedMinor || (c.assessedMinor === 0 && (!c.exemptionConfirmed || c.chargeableGuests !== 0))) issues.push('assessment');
      return {key: c.key, revision: c.revision, nights: c.nights, chargeableGuests: c.chargeableGuests, rateMinor: c.rateMinor, assessedMinor: c.assessedMinor, collectedMinor: 0, balanceMinor: null, refundReviewMinor: 0, status: 'review'};
    });
    const seen = new Map();
    for (const entry of tax.allocations) {
      exactKeys(entry, ['id','type','state','component','capturedMinor','refundedMinor','currency','reservation','account','merchant','mode']);
      assert(entry && identifier(entry.id), 'Invalid allocation identity.');
      const fingerprint = canonical(entry);
      if (seen.has(entry.id)) {
        if (seen.get(entry.id) !== fingerprint) issues.push('conflicting_duplicate');
        continue;
      }
      seen.set(entry.id, fingerprint);
      // Optional purchases can never satisfy a tourist-tax component.
      if (['minibar', 'deposit', 'key_charge'].includes(entry.type)) continue;
      if (entry.type !== 'tourist_tax') { issues.push('unmapped_component'); continue; }
      if (entry.state !== 'captured') {
        if (entry.state === 'pending') issues.push('capture_pending');
        else if (!['declined', 'expired'].includes(entry.state)) issues.push('payment_evidence');
        continue;
      }
      if (!minor(entry.capturedMinor) || !minor(entry.refundedMinor) || entry.refundedMinor > entry.capturedMinor) { issues.push('payment_evidence'); continue; }
      const component = components.find(c => c.key === entry.component);
      if (!component || entry.currency !== 'CHF' || entry.reservation !== stay.id || entry.account !== stay.account || entry.merchant !== stay.merchant || entry.mode !== 'demo') { issues.push('payment_scope'); continue; }
      component.collectedMinor += entry.capturedMinor - entry.refundedMinor;
      if (!minor(component.collectedMinor)) issues.push('payment_evidence');
    }
    const reviewed = issues.length > 0 || tax.priorCollectionConfirmed !== true;
    for (const component of components) {
      if (reviewed) continue;
      const difference = component.assessedMinor - component.collectedMinor;
      component.balanceMinor = Math.max(0, difference);
      component.refundReviewMinor = Math.max(0, -difference);
      component.status = difference < 0 ? 'refund_review' : difference > 0 ? 'outstanding' : component.assessedMinor === 0 ? 'exempt' : 'paid';
    }
    const assessmentMinor = components.reduce((sum, c) => sum + c.assessedMinor, 0);
    const collectedMinor = components.reduce((sum, c) => sum + c.collectedMinor, 0);
    const outstandingMinor = reviewed ? null : components.reduce((sum, c) => sum + c.balanceMinor, 0);
    const refundReviewMinor = reviewed ? null : components.reduce((sum, c) => sum + c.refundReviewMinor, 0);
    // Keep levies separate: surplus on one cannot silently settle the other.
    const status = reviewed ? 'review' : refundReviewMinor > 0 ? 'refund_review' : outstandingMinor > 0 ? 'outstanding' : components.every(c => c.status === 'exempt') ? 'exempt' : 'settled';
    return {status, components, assessmentMinor, collectedMinor, outstandingMinor, refundReviewMinor, issues: [...new Set(issues)]};
  }
  function validateStay(stay) {
    exactKeys(stay, ['schemaVersion','demo','id','account','merchant','currency','booking','channel','accommodationPayment','registration','tax','card','arrival']);
    assert(stay && stay.demo === true && stay.schemaVersion === 1, 'Only explicit synthetic review records are supported.');
    assert(identifier(stay.id) && identifier(stay.account) && identifier(stay.merchant) && stay.currency === 'CHF', 'Invalid review record scope.');
    assert(states.booking.includes(stay.booking) && states.channel.includes(stay.channel) && states.payment.includes(stay.accommodationPayment), 'Unknown booking or payment state.');
    exactKeys(stay.registration, ['required','verified','linkState']);
    exactKeys(stay.card, ['eligibility','state']);
    exactKeys(stay.arrival, ['state']);
    assert(Number.isSafeInteger(stay.registration.required) && stay.registration.required > 0 && stay.registration.required <= 100 && Number.isSafeInteger(stay.registration.verified) && stay.registration.verified >= 0 && stay.registration.verified <= stay.registration.required, 'Invalid registration progress.');
    assert(states.link.includes(stay.registration.linkState), 'Unknown registration-link state.');
    assert(stay.card && states.card.includes(stay.card.state) && states.eligibility.includes(stay.card.eligibility), 'Unknown card state.');
    assert(stay.arrival && states.arrival.includes(stay.arrival.state), 'Unknown arrival state.');
  }
  function derive(stay) {
    validateStay(stay);
    const tax = taxStatement(stay);
    const registration = stay.registration.verified === stay.registration.required ? 'complete' : 'incomplete';
    const card = stay.card.eligibility === 'not_eligible' ? 'not_eligible' : stay.card.eligibility === 'unknown' ? 'review' : stay.card.state;
    const arrival = ['cancelled', 'moved'].includes(stay.booking) ? stay.booking : stay.booking === 'unknown' ? 'unknown' : stay.arrival.state;
    let next = 'ready';
    if (stay.booking === 'cancelled') next = 'cancelled';
    else if (stay.booking === 'moved') next = 'moved';
    else if (stay.booking === 'unknown') next = 'help';
    else if (['review', 'refund_review'].includes(tax.status) || arrival === 'needs_help') next = 'help';
    else if (stay.accommodationPayment !== 'paid') next = 'payment';
    else if (registration === 'incomplete' && stay.registration.linkState !== 'available') next = 'link_help';
    else if (registration === 'incomplete') next = 'registration';
    else if (tax.status === 'outstanding') next = 'tax';
    else if (card === 'needs_resend') next = 'card';
    else if (arrival === 'unknown') next = 'help';
    else if (arrival === 'withheld') next = 'arrival';
    else if (!['delivered', 'not_eligible'].includes(card)) next = 'card';
    // No door codes, bearer links or client-side release authorization exist here.
    return {booking: stay.booking, channel: stay.channel, accommodationPayment: stay.accommodationPayment, registration, registrationLink: stay.registration.linkState, registrationRequired: stay.registration.required, registrationVerified: stay.registration.verified, tax, historicalStatement: stay.booking !== 'confirmed', card, arrival, next, privateAccessEnabled: false, paymentEnabled: false, sendEnabled: false};
  }
  function sample(key = 'before_travel') {
    const stay = {
      schemaVersion: 1, demo: true, id: 'sample-stay', account: 'sample-account', merchant: 'sample-merchant', currency: 'CHF', booking: 'confirmed', channel: 'direct', accommodationPayment: 'paid',
      registration: {required: 2, verified: 1, linkState: 'available'},
      tax: {priorCollectionConfirmed: true, components: ['regional', 'communal'].map(component => ({key: component, revision: 'sample-v1', rateMinor: 300, nights: 3, chargeableGuests: 2, assessedMinor: 1800, confirmed: true, exemptionConfirmed: false})), allocations: [{id: 'sample-regional-payment', type: 'tourist_tax', state: 'captured', component: 'regional', capturedMinor: 1800, refundedMinor: 0, currency: 'CHF', reservation: 'sample-stay', account: 'sample-account', merchant: 'sample-merchant', mode: 'demo'}]},
      card: {eligibility: 'confirmed', state: 'issued'}, arrival: {state: 'withheld'}
    };
    const allocation = (id, component, amount, refunded = 0) => ({...stay.tax.allocations[0], id, component, capturedMinor: amount, refundedMinor: refunded});
    if (key === 'ready') { stay.registration.verified = 2; stay.tax.allocations.push(allocation('sample-communal-payment', 'communal', 1800)); stay.card.state = 'delivered'; stay.arrival.state = 'available'; }
    else if (key === 'review') { stay.registration.verified = 2; stay.tax.priorCollectionConfirmed = false; stay.card.state = 'requested'; }
    else if (key === 'exempt') { stay.registration.verified = 2; stay.tax.allocations = []; for (const c of stay.tax.components) {c.assessedMinor = 0; c.chargeableGuests = 0; c.exemptionConfirmed = true;} stay.card.state = 'delivered'; stay.arrival.state = 'available'; }
    else if (key === 'changed_stay') { stay.registration.verified = 2; for (const c of stay.tax.components) {c.nights = 2; c.assessedMinor = 1200; c.revision = 'sample-v2';} stay.tax.allocations.push(allocation('sample-communal-payment', 'communal', 1800, 300)); stay.card.state = 'delivered'; }
    else if (key === 'airbnb') { stay.channel = 'airbnb'; stay.registration.verified = 2; stay.tax.allocations.push(allocation('sample-communal-payment', 'communal', 1800)); stay.card.state = 'needs_resend'; }
    else if (key === 'cancelled') { stay.booking = 'cancelled'; stay.arrival.state = 'available'; }
    else if (key === 'moved') { stay.booking = 'moved'; stay.arrival.state = 'available'; }
    else if (key === 'lost_link') { stay.registration.linkState = 'expired'; }
    else if (key === 'payment_pending') { stay.accommodationPayment = 'pending'; }
    else assert(key === 'before_travel', 'Unknown review scenario.');
    return stay;
  }
  const api = Object.freeze({derive, taxStatement, sample});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JadoreArrivalState = api;
})(typeof window !== 'undefined' ? window : {});
