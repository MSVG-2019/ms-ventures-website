'use strict';
// Carry only public travel selections. Never carry reservation identifiers or tokens.
(function () {
  const providerOrigin = 'https://jadore-montreux.holidayfuture.com';
  const homeOrStay = /^\/(?:index\.html|(?:fr|de|es|zh)\/(?:index\.html)?)?$|^\/(?:fr\/|de\/|es\/|zh\/)?(?:stays\/[a-z0-9-]+|all-stays)\/(?:index\.html)?$/;
  function today() {
    const parts = new Intl.DateTimeFormat('en', {timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(x => [x.type,x.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function validate(value, maxGuests = 6, currentDay = today()) {
    if (!value || !validDate(value.start) || !validDate(value.end)) return 'missing';
    if (value.start < currentDay) return 'past';
    if (value.end <= value.start) return 'order';
    if (!/^[1-6]$/.test(String(value.guests)) || Number(value.guests) > maxGuests) return 'guests';
    return '';
  }
  function read(search, currentDay = today()) {
    const params = new URLSearchParams(search);
    const value = {start:params.get('start'),end:params.get('end'),guests:params.get('numberOfGuests')};
    return validate(value, 6, currentDay) ? null : {...value,guests:Number(value.guests)};
  }
  // A bounded browsing draft is distinct from a provider-ready date/party search.
  // Preserve independently valid public choices locally, even while dates are incomplete.
  function normalizeDraft(value, currentDay = today()) {
    if (!value || typeof value !== 'object') return null;
    const start = validDate(value.start) && value.start >= currentDay ? value.start : '';
    const end = validDate(value.end) && value.end >= currentDay ? value.end : '';
    const guests = /^[1-6]$/.test(String(value.guests)) ? Number(value.guests) : null;
    return start || end || guests !== null ? {start, end, guests} : null;
  }
  function readDraft(search, currentDay = today()) {
    const params = new URLSearchParams(search);
    return normalizeDraft({start:params.get('start'),end:params.get('end'),guests:params.get('numberOfGuests')},currentDay);
  }
  function urlFor(href, value, currentDay = today()) {
    let target;
    try { target = new URL(href, window.location.href); } catch { return null; }
    if (target.username || target.password) return null;
    const local = target.origin === window.location.origin && homeOrStay.test(target.pathname);
    const provider = target.origin === providerOrigin && /^\/(?:search|all-listings|listings\/[0-9]+)\/?$/.test(target.pathname);
    if (!local && !provider) return null;
    target.search = '';
    if (local) {
      const draft = normalizeDraft(value, currentDay);
      if (draft?.start) target.searchParams.set('start', draft.start);
      if (draft?.end) target.searchParams.set('end', draft.end);
      if (draft?.guests !== null && draft?.guests !== undefined) target.searchParams.set('numberOfGuests', String(draft.guests));
    } else if (value && !validate(value, 6, currentDay)) {
      if (/^\/all-listings\/?$/.test(target.pathname)) target.pathname = '/search';
      target.searchParams.set('start', value.start);
      target.searchParams.set('end', value.end);
      target.searchParams.set('numberOfGuests', String(value.guests));
    }
    return target.href;
  }
  let selection = read(window.location.search);
  let draft = readDraft(window.location.search);
  function decorateLink(anchor) {
    if (!anchor || !anchor.getAttribute('href') || anchor.getAttribute('href').startsWith('#')) return;
    const url = urlFor(anchor.getAttribute('href'), draft);
    if (url) anchor.href = url;
  }
  function decorateAll() { document.querySelectorAll('a[href]').forEach(decorateLink); }
  function set(value) {
    selection = value && !validate(value) ? {start:value.start,end:value.end,guests:Number(value.guests)} : null;
    draft = normalizeDraft(value);
    const current = urlFor(window.location.href, draft);
    if (current && window.history?.replaceState) window.history.replaceState(null, '', current);
    decorateAll();
    return selection ? {...selection} : null;
  }
  window.JADORE_SELECTION = Object.freeze({today,validDate,validate,read,readDraft,urlFor,set,decorateLink,get:()=>selection ? {...selection} : null,getDraft:()=>draft ? {...draft} : null});
  decorateAll();
  // Newly rendered concierge links and locale links receive the same bounded handoff.
  document.addEventListener('click', event => decorateLink(event.target.closest?.('a[href]')), true);
})();
