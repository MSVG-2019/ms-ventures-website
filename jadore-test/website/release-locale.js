'use strict';
// Generated release-only enhancement. The initial document already contains its language.
const select = document.getElementById('language');
const links = document.getElementById('release-language-links');
if (select && links) {
  const urls = Object.fromEntries(Array.from(links.querySelectorAll('a')).map(a => [a.hreflang, a.href]));
  select.value = document.documentElement.lang;
  select.dispatchEvent(new Event('change', {bubbles:true}));
  select.addEventListener('change', event => {
    event.stopImmediatePropagation();
    if (urls[select.value]) {
      const travel = window.JADORE_SELECTION;
      travel?.set({start:document.querySelector('#check-in').value,end:document.querySelector('#check-out').value,guests:document.querySelector('#guests').value});
      window.location.assign(travel?.urlFor(urls[select.value], travel.getDraft()) || urls[select.value]);
    }
  }, true);
}
