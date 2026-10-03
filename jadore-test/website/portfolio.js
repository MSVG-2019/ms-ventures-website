'use strict';
// Filter static, reviewed public options. Live availability and prices stay in Hostaway.
(function () {
  const selection=window.JADORE_SELECTION;
  const form=document.querySelector('#portfolio-search');
  if(!selection||!form)return;
  const lang=['en','fr','de','es','zh'].includes(document.body.dataset.language)?document.body.dataset.language:'en';
  const copy={
    en:{missing:'Choose check-in and check-out dates to check your price.',past:'Choose today or a future check-in date.',order:'Check-out must be after check-in.',guests:'Choose between 1 and 6 guests.',count:(n,g)=>`${n} stay options fit ${g} guests.`,none:'No options match these filters. Try another type of stay, a different search or contact our team.'},
    fr:{missing:'Choisissez les dates d’arrivée et de départ pour vérifier votre prix.',past:'Choisissez aujourd’hui ou une date d’arrivée future.',order:'Le départ doit être après l’arrivée.',guests:'Choisissez entre 1 et 6 voyageurs.',count:(n,g)=>`${n} options de séjour conviennent à ${g} voyageurs.`,none:'Aucune option ne correspond à ces filtres. Essayez un autre type de logement, une autre recherche ou contactez notre équipe.'},
    de:{missing:'Wählen Sie Anreise- und Abreisedatum, um Ihren Preis zu prüfen.',past:'Wählen Sie heute oder ein zukünftiges Anreisedatum.',order:'Die Abreise muss nach der Anreise liegen.',guests:'Wählen Sie zwischen 1 und 6 Gästen.',count:(n,g)=>`${n} Unterkunftsoptionen bieten Platz für ${g} Gäste.`,none:'Keine Optionen passen zu diesen Filtern. Wählen Sie eine andere Unterkunftsart oder Suche, oder kontaktieren Sie unser Team.'},
    es:{"missing":"Elija las fechas de llegada y salida para consultar su precio.","past":"Elija hoy o una fecha futura para su llegada.","order":"La fecha de salida debe ser posterior a la de llegada.","guests":"Elija entre 1 y 6 huéspedes.","none":"Ningún alojamiento coincide con estos filtros. Pruebe otro tipo de estancia, una búsqueda diferente o contacte con nuestro equipo.","count":(n,g)=>"{count} {optionLabel} de alojamiento para {guests} {guestLabel}.".replace('{count}',String(n)).replace('{guests}',String(g)).replace('{optionLabel}',n===1?"opción":"opciones").replace('{guestLabel}',g===1?"huésped":"huéspedes")},
    zh:{"missing":"请选择入住和退房日期，以查看价格。","past":"请选择今天或之后的入住日期。","order":"退房日期必须晚于入住日期。","guests":"请选择 1 至 6 人。","none":"没有符合这些筛选条件的住宿选项。请尝试其他住宿类型、修改搜索，或联系我们的团队。","count":(n,g)=>"{n} 个住宿选项可容纳 {g} 人。".replace('{n}',String(n)).replace('{g}',String(g))}
  }[lang];
  const arrival=document.querySelector('#portfolio-check-in'),departure=document.querySelector('#portfolio-check-out'),guests=document.querySelector('#portfolio-guests'),type=document.querySelector('#portfolio-kind'),search=document.querySelector('#portfolio-query'),error=document.querySelector('#portfolio-error'),count=document.querySelector('#portfolio-count'),empty=document.querySelector('#portfolio-empty');
  const cards=Array.from(document.querySelectorAll('.portfolio-card')).map(card=>({card,kind:card.dataset.kind,max:Number(card.dataset.maxGuests),text:card.textContent,link:card.querySelector('.portfolio-booking-link'),href:card.querySelector('.portfolio-booking-link').href,native:card.querySelector('.portfolio-booking-link').dataset.bookingType==='native'}));
  function normal(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(lang).trim();}
  function values(){return{start:arrival.value,end:departure.value,guests:guests.value};}
  function clearError(){error.textContent='';[arrival,departure,guests].forEach(field=>field.removeAttribute('aria-invalid'));}
  function showError(code){error.textContent=copy[code];const field=code==='guests'?guests:code==='order'||(selection.validDate(arrival.value)&&!selection.validDate(departure.value))?departure:arrival;field.setAttribute('aria-invalid','true');return field;}
  function next(value){const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);}
  function update(){
    const current=values(),code=selection.validate(current),party=Number(guests.value),needle=normal(search.value);let shown=0;
    for(const item of cards){const matches=Number.isInteger(party)&&party>=1&&party<=6&&item.max>=party&&(type.value==='all'||type.value==='entire'&&item.kind!=='private-room'||type.value===item.kind)&&(!needle||normal(item.text).includes(needle));item.card.hidden=!matches;if(matches)shown++;
      item.link.href=item.native&&code?'#portfolio-search':selection.urlFor(item.href,selection.get());
    }
    count.textContent=copy.count(shown,party);empty.textContent=copy.none;empty.hidden=shown!==0;
  }
  const incoming=selection.get();if(incoming){arrival.value=incoming.start;departure.value=incoming.end;guests.value=String(incoming.guests);}
  arrival.min=selection.today();departure.min=next(arrival.value||selection.today());
  [arrival,departure,guests].forEach(field=>field.addEventListener('change',()=>{clearError();if(selection.validDate(arrival.value))departure.min=next(arrival.value);selection.set(values());update();}));
  type.addEventListener('change',update);search.addEventListener('input',update);
  document.querySelector('#portfolio-reset').addEventListener('click',()=>{type.value='all';search.value='';update();search.focus();});
  for(const item of cards){if(item.native)item.link.addEventListener('click',event=>{const code=selection.validate(values());if(code){event.preventDefault();showError(code).focus();}});}
  form.addEventListener('submit',event=>{event.preventDefault();clearError();const code=selection.validate(values());if(code){showError(code).focus();return;}selection.set(values());update();count.focus();});
  update();
})();
