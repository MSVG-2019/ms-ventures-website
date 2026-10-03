'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const language = $('arrival-language');
  const scenario = $('arrival-scenario');
  const locales = {en:'en-CH',fr:'fr-CH',de:'de-CH',es:'es-ES',zh:'zh-CN'};
  const allowedAnchors = new Set(['#registration','#taxes','#riviera-card','#arrival-guide','#help']);
  const query = new URLSearchParams(window.location.search);
  if (Object.hasOwn(locales, query.get('lang'))) language.value = query.get('lang');
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function interpolate(text, values) {
    return text.replace(/\{([a-z]+)\}/g, (_, key) => String(values[key] ?? ''));
  }
  const readable = value => typeof value === 'string' && value.trim().length > 0;
  function requiredText(value) {if (!readable(value)) throw new Error('Missing state explanation.'); return value;}
  function badge(id, label, complete) { $(id).replaceChildren(node('span',requiredText(label),'status'+(complete?' complete':''))); }
  function render(announce = false) {
    try {
      const locale = Object.hasOwn(locales,language.value) ? language.value : 'en';
      const m = window.JadoreArrivalCopy[locale];
      if (!m) throw new Error('Missing reviewed language.');
      const stay = window.JadoreArrivalState.sample(scenario.value);
      const state = window.JadoreArrivalState.derive(stay);
      document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
      document.title = 'J’adore Montreux · ' + m.arrival + ' · ' + m.reviewLabel;
      $('arrival-back').href = locale === 'en' ? '/' : '/' + locale + '/';
      $('arrival-home').href = $('arrival-back').href;
      $('arrival-card-benefits').href = 'https://www.montreuxriviera.com/' + (['en','fr','de'].includes(locale)?locale:'en') + '/PA372/montreux-riviera-card';
      document.querySelectorAll('[data-copy]').forEach(el => {
        const text = m[el.dataset.copy];
        if (!readable(text)) throw new Error('Missing guest copy.');
        el.textContent = text;
      });
      $('progress-label').setAttribute('aria-label', m.progressLabel);
      for (const option of scenario.options) {
        if (!m.scenarios[option.value]) throw new Error('Missing scenario copy.');
        option.textContent = requiredText(m.scenarios[option.value]);
      }
      $('booking-status').textContent = requiredText(m.bookingStatuses[state.booking]);
      document.querySelector('[data-copy="stayDetails"]').textContent = interpolate(m.stayDetails,{guests:state.registrationRequired,nights:stay.tax.components[0].nights});
      const next = m.next[state.next];
      if (!Array.isArray(next) || next.length !== 4 || !next.slice(0,3).every(readable) || !allowedAnchors.has(next[3])) throw new Error('Invalid next action.');
      $('next-title').textContent = next[0];
      $('next-description').textContent = next[1];
      $('next-link').textContent = next[2];
      $('next-link').href = next[3];
      badge('payment-status',m.paymentStatuses[state.accommodationPayment],state.accommodationPayment==='paid');
      badge('registration-status',interpolate(m.registrationCount,{verified:state.registrationVerified,required:state.registrationRequired}),state.registration==='complete');
      badge('tax-status',state.historicalStatement?m.historicalStatement:m.taxStatuses[state.tax.status],!state.historicalStatement&&['settled','exempt'].includes(state.tax.status));
      badge('card-status',m.cardStatuses[state.card],['delivered','not_eligible'].includes(state.card));
      badge('arrival-status',m.arrivalStatuses[state.arrival],state.arrival==='available');
      const travellers = $('traveller-list');
      travellers.replaceChildren();
      for (let i = 1; i <= state.registrationRequired; i++) {
        const li = node('li',undefined,'traveller');
        li.append(node('span',interpolate(m.traveller,{number:i})),node('span',i<=state.registrationVerified?m.verified:m.missing));
        travellers.append(li);
      }
      const money = value => value === null ? m.pendingAmount : new Intl.NumberFormat(locales[locale],{style:'currency',currency:'CHF'}).format(value/100);
      const lines = $('tax-lines');
      lines.replaceChildren();
      for (const component of state.tax.components) {
        const line = node('section',undefined,'tax-line');
        line.append(node('h3',requiredText(m[component.key])),node('p',interpolate(requiredText(m.calculation),{guests:component.chargeableGuests,nights:component.nights,rate:money(component.rateMinor)})));
        const rows = [[m.assessed,component.assessedMinor],[m.collected,component.collectedMinor],[state.historicalStatement?m.historicalBalance:m.balance,component.balanceMinor]];
        if (component.refundReviewMinor > 0) rows.push([m.refund,component.refundReviewMinor]);
        for (const [label,value] of rows) { const row=node('div',undefined,'money-row');row.append(node('span',requiredText(label)),node('span',money(value)));line.append(row); }
        const status = requiredText(state.historicalStatement?m.historicalStatement:m.taxStatuses[component.status]);
        if (!status) throw new Error('Missing component-state copy.');
        line.append(node('span',status,'status'+(!state.historicalStatement&&['paid','exempt'].includes(component.status)?' complete':'')));
        lines.append(line);
      }
      const totals = $('tax-totals');
      totals.replaceChildren();
      const rows = [[m.totalAssessed,state.tax.assessmentMinor],[m.totalCollected,state.tax.collectedMinor]];
      if (state.tax.refundReviewMinor > 0) rows.push([m.totalRefund,state.tax.refundReviewMinor]);
      rows.push([state.historicalStatement?m.historicalBalance:m.totalBalance,state.tax.outstandingMinor]);
      for (const [label,value] of rows) {const row=node('div');row.append(node('dt',requiredText(label)),node('dd',money(value)));totals.append(row);}
      $('tax-explanation').textContent = requiredText(['cancelled','moved','unknown'].includes(state.booking) ? m.cancelledTax : m.taxExplanations[state.tax.status]);
      $('card-explanation').textContent = requiredText(m.cardExplanations[state.card]);
      $('arrival-explanation').textContent = requiredText(m.arrivalExplanations[state.arrival]);
      const channel = m.channels[state.channel];
      $('channel-title').textContent = requiredText(channel[0]);
      $('channel-explanation').textContent = requiredText(channel[1]);
      $('scenario-status').textContent = announce ? interpolate(m.scenarioChanged,{next:next[0]}) : '';
    } catch (_) {
      // Preserve visible help, remove unverified monetary/status claims on any failure.
      const m = window.JadoreArrivalCopy[language.value] || window.JadoreArrivalCopy.en;
      const fallback = window.JadoreArrivalCopy.en;
      const message = readable(m.error) ? m.error : readable(fallback.error) ? fallback.error : 'This review is unavailable. For an actual stay, contact the host through your booking confirmation.';
      $('next-title').textContent = readable(m.helpTitle) ? m.helpTitle : 'Contact your host';
      $('next-description').textContent = message;
      $('next-link').textContent = readable(m.next?.help?.[2]) ? m.next.help[2] : 'Find the help route';
      $('next-link').href = '#help';
      for (const id of ['payment-status','registration-status','tax-status','card-status','arrival-status','tax-lines','tax-totals','traveller-list','booking-status','card-explanation','arrival-explanation','channel-title','channel-explanation']) $(id).replaceChildren();
      document.querySelector('[data-copy="stayDetails"]').replaceChildren();
      $('tax-explanation').textContent = message;
      $('scenario-status').textContent = message;
    }
  }
  scenario.addEventListener('change',() => render(true));
  language.addEventListener('change',() => render(true));
  render();
})();
