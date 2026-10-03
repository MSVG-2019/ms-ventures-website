'use strict';
(function () {
  const selection = window.JADORE_SELECTION;
  const body = document.body;
  if (!selection || !body.dataset.listingId) return;
  const language = ['en','fr','de','es','zh'].includes(body.dataset.language) ? body.dataset.language : 'en';
  const max = Number(body.dataset.maxGuests);
  const copy = {
    en:{title:'Your dates',arrival:'Check-in',departure:'Check-out',guests:'Guests',submit:'Check Dates & Price ↗',missing:'Choose check-in and check-out dates.',past:'Choose today or a future check-in date.',order:'Check-out must be after check-in.',capacity:`This stay accommodates up to ${max} guests. Adjust the guest count or explore another stay.`,note:'Check availability and prices on the booking website. Before paying, confirm all mandatory charges, tourist taxes and cancellation terms; taxes may be collected separately.'},
    fr:{title:'Vos dates',arrival:'Arrivée',departure:'Départ',guests:'Voyageurs',submit:'Voir Dates et Prix ↗',missing:'Choisissez les dates d’arrivée et de départ.',past:'Choisissez aujourd’hui ou une date d’arrivée future.',order:'Le départ doit être après l’arrivée.',capacity:`Ce logement accueille jusqu’à ${max} voyageurs. Modifiez le nombre de voyageurs ou choisissez un autre logement.`,note:'Consultez les disponibilités et les prix sur le site de réservation. Avant de payer, confirmez les frais obligatoires, les taxes de séjour et les conditions d’annulation ; les taxes peuvent être perçues séparément.'},
    de:{title:'Ihre Reisedaten',arrival:'Anreise',departure:'Abreise',guests:'Gäste',submit:'Daten und Preis Prüfen ↗',missing:'Wählen Sie Anreise- und Abreisedatum.',past:'Wählen Sie heute oder ein zukünftiges Anreisedatum.',order:'Die Abreise muss nach der Anreise liegen.',capacity:`Diese Unterkunft bietet Platz für bis zu ${max} Gäste. Ändern Sie die Gästezahl oder wählen Sie eine andere Unterkunft.`,note:'Prüfen Sie Verfügbarkeit und Preise auf der Buchungswebsite. Bestätigen Sie vor der Zahlung alle Pflichtgebühren, Kurtaxen und Stornierungsbedingungen; die Abgaben können separat eingezogen werden.'},
    es:{"title":"Sus fechas","arrival":"Llegada","departure":"Salida","guests":"Huéspedes","submit":"Consultar fechas y precio ↗","missing":"Elija las fechas de llegada y salida.","past":"Elija hoy o una fecha futura para su llegada.","order":"La fecha de salida debe ser posterior a la de llegada.","note":"Consulte disponibilidad y precios en el sitio de reservas. Antes de pagar, confirme todos los cargos obligatorios, las tasas turísticas y las condiciones de cancelación; las tasas pueden cobrarse por separado.","capacity":"Este alojamiento admite hasta {max} huéspedes. Ajuste el número de huéspedes o elija otro alojamiento.".replace('{max}',String(max))},
    zh:{"title":"您的日期","arrival":"入住日期","departure":"退房日期","guests":"入住人数","submit":"查看日期和价格 ↗","missing":"请选择入住和退房日期。","past":"请选择今天或之后的入住日期。","order":"退房日期必须晚于入住日期。","note":"请在预订网站查看空房和价格。付款前，请确认所有必付费用、住宿税和取消条款；住宿税可能另行收取。","capacity":"此住宿最多可住 {max} 人。请调整入住人数，或探索其他住宿。".replace('{max}',String(max))}
  }[language];
  const el = (tag,text) => {const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const form=el('form');form.id='property-booking';form.className='property-booking';form.noValidate=true;
  const heading=el('h3',copy.title);form.append(heading);
  function field(label,type,id){const wrap=el('label',label),input=el('input');input.type=type;input.id=id;input.required=true;input.setAttribute('aria-describedby','property-booking-error');wrap.append(input);form.append(wrap);return input;}
  const arrival=field(copy.arrival,'date','property-check-in'),departure=field(copy.departure,'date','property-check-out');
  const guestsLabel=el('label',copy.guests),guests=el('select');guests.id='property-guests';guests.setAttribute('aria-describedby','property-booking-error');
  for(let n=1;n<=max;n++){const option=el('option',String(n));option.value=String(n);guests.append(option);}guests.value=String(Math.min(2,max));guestsLabel.append(guests);form.append(guestsLabel);
  const button=el('button',copy.submit);button.type='submit';button.className='button';form.append(button);
  const error=el('p');error.id='property-booking-error';error.className='form-error';error.setAttribute('role','alert');form.append(error,el('p',copy.note));
  const aside=document.querySelector('.stay-aside');aside.querySelector('.button').before(form);
  const existing=selection.getDraft();
  if(existing){arrival.value=existing.start;departure.value=existing.end;if(existing.guests>max){const option=el('option',String(existing.guests));option.value=String(existing.guests);option.disabled=true;guests.append(option);}if(existing.guests!==null)guests.value=String(existing.guests);}
  const next=value=>{const day=new Date(value+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+1);return day.toISOString().slice(0,10);};
  arrival.min=selection.today();departure.min=next(arrival.value||selection.today());
  const nativeLinks=Array.from(document.querySelectorAll(`a[href*="/listings/${body.dataset.listingId}"]`)).map(anchor=>({anchor,url:anchor.href}));
  function values(){return {start:arrival.value,end:departure.value,guests:guests.value};}
  function clear(){error.textContent='';[arrival,departure,guests].forEach(x=>x.removeAttribute('aria-invalid'));}
  function showError(code){error.textContent=code==='guests'?copy.capacity:copy[code];const target=code==='guests'?guests:code==='order'||(!selection.validDate(departure.value)&&selection.validDate(arrival.value))?departure:arrival;target.setAttribute('aria-invalid','true');return target;}
  function correctionCode(){return Number(guests.value)>max?'guests':arrival.value||departure.value?selection.validate(values(),max):'';}
  function updateNativeLinks(){nativeLinks.forEach(({anchor,url})=>{anchor.href=correctionCode()?'#property-booking':selection.urlFor(url,selection.get());});}
  [arrival,departure,guests].forEach(input=>input.addEventListener('change',()=>{clear();if(selection.validDate(arrival.value))departure.min=next(arrival.value);selection.set(values());updateNativeLinks();if(Number(guests.value)>max)showError('guests');}));
  nativeLinks.forEach(({anchor})=>anchor.addEventListener('click',event=>{const code=correctionCode();if(code){event.preventDefault();showError(code).focus();}}));
  updateNativeLinks();if(existing&&existing.guests>max)showError('guests');
  form.addEventListener('submit',event=>{event.preventDefault();clear();const value=values(),code=selection.validate(value,max);if(code){showError(code).focus();return;}selection.set(value);window.location.assign(selection.urlFor(`https://jadore-montreux.holidayfuture.com/listings/${body.dataset.listingId}`,value));});
})();
