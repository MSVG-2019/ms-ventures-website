'use strict';
// The preview reads no provider credentials or guest records. All availability and
// payments remain on the existing provider website; date and guest-count transfer has been checked against the public search UI.
const english = Object.fromEntries(Array.from(document.querySelectorAll('[data-i18n]')).map(el => [el.dataset.i18n, el.innerHTML]));
let lang = 'en';
let guideSection = 'checklist';
const messages = {
  en: {missing:'Please choose check-in and check-out dates.',past:'Check-in must be today or a future date.',order:'Check-out must be after check-in.',close:'Close',menu:'Open navigation',nav:'Main navigation',filter:'Filter stays',guideSections:'Arrival guide sections',selection:(a,b,g)=>`${a} — ${b} · ${g} ${g===1?'guest':'guests'}`,title:'J’adore Montreux — Stay a Little Longer',
    checklistTitle:'Before you travel',checklist:['Guest registration — use the secure link in your reservation confirmation.','Tourist taxes — check the itemised amount and anything already collected.','Riviera Card — confirm eligibility and delivery with your host.','Arrival instructions — check the correct property, arrival time and a working host contact.'],status:'Proposed checklist · no live completion status',help:'If a form, payment link or access instruction fails, contact the host through your reservation. Do not submit identity documents on this preview.',
    taxTitle:'Two taxes. One clear explanation.',taxLabel:'ILLUSTRATION ONLY · NOT A QUOTE',taxIntro:'Example: two taxable adults, three nights in a Montreux apartment. Classification, applicable rates and exemptions must be confirmed for your reservation.',regional:'Regional tourist tax',communal:'Communal tourist tax',calculation:'2 adults × 3 nights × CHF 3',taxTotal:'Illustrative total',taxFoot:'If already collected, the outstanding balance should be reduced accordingly. Children and other exempt guests need a separate eligibility check. This example does not create a payment request.',
    localTitle:'A few useful starting points',localIntro:'Your private guide would bring these together with property-specific directions, parking and verified help.',links:['Official Montreux Riviera Guide','Riviera Card Benefits & Conditions','Swiss Rail Journey Planner'],localFoot:'Building access and Wi-Fi details belong in your private reservation guide, never on the public website.'},
  fr: {missing:'Choisissez les dates d’arrivée et de départ.',past:'La date d’arrivée doit être aujourd’hui ou dans le futur.',order:'Le départ doit être après l’arrivée.',close:'Fermer',menu:'Ouvrir la navigation',nav:'Navigation principale',filter:'Filtrer les séjours',guideSections:'Rubriques du guide d’arrivée',selection:(a,b,g)=>`${a} — ${b} · ${g} ${g===1?'voyageur':'voyageurs'}`,title:'J’adore Montreux — Prolongez le Plaisir',
    checklistTitle:'Avant votre voyage',checklist:['Enregistrement des voyageurs — utilisez le lien sécurisé de votre confirmation.','Taxes de séjour — vérifiez le détail du montant et les sommes déjà perçues.','Riviera Card — confirmez votre éligibilité et sa remise avec votre hôte.','Instructions d’arrivée — vérifiez le bon logement, l’horaire et un contact joignable.'],status:'Liste proposée · aucun statut réel de progression',help:'Si un formulaire, un lien de paiement ou une instruction d’accès pose problème, contactez l’hôte via votre réservation. Ne déposez aucun document d’identité sur cet aperçu.',
    taxTitle:'Deux taxes. Une explication claire.',taxLabel:'EXEMPLE UNIQUEMENT · PAS UN DEVIS',taxIntro:'Exemple : deux adultes assujettis, trois nuits dans un appartement à Montreux. La catégorie du logement, les tarifs et les exemptions doivent être confirmés pour votre réservation.',regional:'Taxe de séjour régionale',communal:'Taxe communale de séjour',calculation:'2 adultes × 3 nuits × CHF 3',taxTotal:'Total indicatif',taxFoot:'Les sommes déjà perçues doivent être déduites du solde à payer. L’éligibilité des enfants et des autres personnes exonérées doit être vérifiée séparément. Cet exemple ne crée aucune demande de paiement.',
    localTitle:'Quelques points de départ utiles',localIntro:'Votre guide privé réunirait ces informations avec l’itinéraire propre au logement, le stationnement et une aide vérifiée.',links:['Guide Officiel Montreux Riviera','Avantages et Conditions de la Riviera Card','Planificateur de Voyages CFF'],localFoot:'Les codes d’accès et les informations Wi-Fi restent dans le guide privé de votre réservation, jamais sur le site public.'},
  de: {missing:'Bitte wählen Sie Anreise- und Abreisedatum.',past:'Die Anreise muss heute oder in der Zukunft liegen.',order:'Die Abreise muss nach der Anreise liegen.',close:'Schliessen',menu:'Navigation öffnen',nav:'Hauptnavigation',filter:'Unterkünfte filtern',guideSections:'Bereiche des Anreiseleitfadens',selection:(a,b,g)=>`${a} — ${b} · ${g} ${g===1?'Gast':'Gäste'}`,title:'J’adore Montreux — Bleiben Sie Etwas Länger',
    checklistTitle:'Vor Ihrer Reise',checklist:['Gästeregistrierung — nutzen Sie den sicheren Link in Ihrer Buchungsbestätigung.','Kurtaxen — prüfen Sie die Aufschlüsselung und bereits eingezogene Beträge.','Riviera Card — bestätigen Sie Anspruch und Übergabe mit Ihrem Gastgeber.','Anreiseinformationen — prüfen Sie die richtige Unterkunft, Ankunftszeit und einen erreichbaren Kontakt.'],status:'Vorgeschlagene Checkliste · kein aktueller Erledigungsstatus',help:'Wenn ein Formular, Zahlungslink oder Zugangshinweis nicht funktioniert, kontaktieren Sie den Gastgeber über Ihre Buchung. Laden Sie in dieser Vorschau keine Ausweisdokumente hoch.',
    taxTitle:'Zwei Abgaben. Eine klare Erklärung.',taxLabel:'NUR EIN BEISPIEL · KEIN ANGEBOT',taxIntro:'Beispiel: zwei abgabepflichtige Erwachsene, drei Nächte in einer Wohnung in Montreux. Unterkunftskategorie, Tarife und Befreiungen müssen für Ihre Buchung bestätigt werden.',regional:'Regionale Kurtaxe',communal:'Kommunale Kurtaxe',calculation:'2 Erwachsene × 3 Nächte × CHF 3',taxTotal:'Beispielbetrag',taxFoot:'Bereits eingezogene Beträge müssen vom offenen Saldo abgezogen werden. Für Kinder und weitere befreite Gäste ist der Anspruch gesondert zu prüfen. Dieses Beispiel erstellt keine Zahlungsaufforderung.',
    localTitle:'Nützliche Ausgangspunkte',localIntro:'Ihr privater Leitfaden würde diese Informationen mit der Wegbeschreibung, Parkmöglichkeiten und verifizierter Hilfe verbinden.',links:['Offizieller Montreux Riviera Reiseführer','Riviera Card: Vorteile und Bedingungen','SBB Reiseplaner'],localFoot:'Zugangs- und WLAN-Daten gehören in Ihren privaten Buchungsleitfaden, niemals auf die öffentliche Website.'}
};
messages.es={"missing":"Elija las fechas de llegada y salida.","past":"La fecha de llegada debe ser hoy o una fecha futura.","order":"La fecha de salida debe ser posterior a la de llegada.","close":"Cerrar","menu":"Abrir la navegación","nav":"Navegación principal","filter":"Filtrar alojamientos","guideSections":"Secciones de la guía de llegada","languageLabel":"Idioma","guestSingular":"huésped","guestPlural":"huéspedes","filterStatusTemplate":"{count} {stayLabel}","stayShownSingular":"alojamiento mostrado","stayShownPlural":"alojamientos mostrados","title":"J’adore Montreux — Quédese un poco más","checklistTitle":"Antes de viajar","checklist":["Registro de huéspedes — utilice el enlace seguro de su confirmación de reserva.","Tasas turísticas — compruebe el desglose y los importes ya cobrados.","Riviera Card — confirme su elegibilidad y cómo recibirá la tarjeta con el anfitrión.","Instrucciones de llegada — compruebe el alojamiento, la hora de llegada y un contacto disponible."],"status":"Lista de pasos propuesta · sin seguimiento en tiempo real","help":"Si un formulario, un enlace de pago o una instrucción de acceso falla, contacte con el anfitrión a través de su reserva. No envíe documentos de identidad en esta vista previa.","taxTitle":"Dos tasas. Una explicación clara.","taxLabel":"SOLO UNA ILUSTRACIÓN · NO ES UN PRESUPUESTO","taxIntro":"Ejemplo: dos adultos sujetos a tasas, tres noches en un apartamento de Montreux. La categoría del alojamiento, las tarifas aplicables y las exenciones deben confirmarse para su reserva.","regional":"Tasa turística regional","communal":"Tasa turística municipal","calculation":"2 adultos × 3 noches × CHF 3","taxTotal":"Total del ejemplo","taxFoot":"Los importes ya cobrados deberían descontarse del saldo pendiente. La elegibilidad de los niños y de otros huéspedes exentos requiere una comprobación independiente. Este ejemplo no crea una solicitud de pago.","localTitle":"Algunos puntos de partida útiles","localIntro":"Su guía privada reuniría esta información con las indicaciones de acceso del alojamiento, el aparcamiento y contactos de asistencia verificados.","links":["Guía oficial de Montreux Riviera","Ventajas y condiciones de la Riviera Card","Planificador de viajes de SBB/CFF"],"localFoot":"Los datos de acceso al edificio y del Wi-Fi deben estar en la guía privada de su reserva, nunca en el sitio público."};
messages.es.selection=(a,b,g)=>"{arrival} — {departure} · {guests} {guestLabel}".replace('{arrival}',a).replace('{departure}',b).replace('{guests}',String(g)).replace('{guestLabel}',g===1?messages.es.guestSingular:messages.es.guestPlural);
messages.zh={"missing":"请选择入住和退房日期。","past":"请选择今天或之后的入住日期。","order":"退房日期必须晚于入住日期。","close":"关闭","menu":"打开导航","nav":"主导航","filter":"筛选住宿","guideSections":"入住指南栏目","title":"J’adore Montreux — 不妨多住一会儿","checklistTitle":"出发之前","checklist":["住客登记 — 使用预订确认信息中的安全链接。","住宿税 — 核对税费明细及已收取金额。","Riviera Card — 向房东确认领取资格和领取方式。","入住信息 — 核对住宿、抵达时间和可联系到的协助人员。"],"status":"拟议准备清单 · 并非实时进度","help":"如果表单、付款链接或门禁说明有问题，请通过您的预订渠道联系房东。请勿在本预览提交身份证件。","taxTitle":"两项税费，一份清楚的说明。","taxLabel":"仅作示例 · 不是报价","taxIntro":"示例：两名应纳税的成人，在蒙特勒一间公寓住宿三晚。住宿类别、适用税率和豁免条件须按您的预订另行确认。","regional":"区域住宿税","communal":"市镇住宿税","calculation":"2 名成人 × 3 晚 × CHF 3","taxTotal":"示例合计","taxFoot":"已经收取的金额应从待付余额中扣除。儿童及其他可能免税的入住者须另行核实。本示例不会创建付款请求。","localTitle":"从这些实用信息开始","localIntro":"您的私人入住指南将汇集这些信息，以及住宿专属门禁说明、停车信息和经核实的协助联系方式。","links":["Montreux Riviera 官方指南","Riviera Card 权益与条件","瑞士联邦铁路 SBB 行程规划"],"localFoot":"楼宇门禁和 Wi-Fi 信息应放在您预订专属的私人指南中，不应公开在网站上。","languageLabel":"语言","filterStatus":"显示 {n} 个住宿选项"};
messages.zh.selection=(a,b,g)=>"{a} — {b} · {g} 人".replace('{a}',a).replace('{b}',b).replace('{g}',String(g));
for(const locale of ['fr','de','es','zh'])Object.assign(messages[locale],window.JADORE_TRANSLATIONS?.[locale]||{});
const $ = s => document.querySelector(s);
function todayZurich(){return window.JADORE_SELECTION.today();}
function validDate(value){return window.JADORE_SELECTION.validDate(value);}
function nextDate(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
$('#check-in').min=todayZurich();
$('#check-out').min=nextDate(todayZurich());
const incomingSelection=window.JADORE_SELECTION.get();
if(incomingSelection){$('#check-in').value=incomingSelection.start;$('#check-out').value=incomingSelection.end;$('#guests').value=String(incomingSelection.guests);$('#check-out').min=nextDate(incomingSelection.start);}
function clearBookingError(){ $('#booking-error').textContent='';$('#check-in').removeAttribute('aria-invalid');$('#check-out').removeAttribute('aria-invalid'); }
function syncSearchSelection(){window.JADORE_SELECTION.set({start:$('#check-in').value,end:$('#check-out').value,guests:$('#guests').value});}
function setLanguage(value){
  lang=messages[value]?value:'en';
  const dict=lang==='en'?english:(window.JADORE_TRANSLATIONS?.[lang]||english);
  document.documentElement.lang=lang;
  const officialLocale=['en','fr','de'].includes(lang)?lang:'en';
  const cardLink=$('.faq-list details:nth-child(3) a');
  cardLink.href=`https://www.montreuxriviera.com/${officialLocale}/PA372/montreux-riviera-card`;
  $('.riviera-copy .text-link').href=`https://www.montreuxriviera.com/${officialLocale}/`;
  document.title=messages[lang].title;
  document.querySelectorAll('[data-i18n]').forEach(el=>{if(dict[el.dataset.i18n])el.innerHTML=dict[el.dataset.i18n];});
  document.querySelectorAll('[data-close]').forEach(el=>el.setAttribute('aria-label',messages[lang].close));
  $('.menu-toggle').setAttribute('aria-label',messages[lang].menu);
  $('#main-nav').setAttribute('aria-label',messages[lang].nav);
  $('.filters').setAttribute('aria-label',messages[lang].filter);
  $('.guide-tabs').setAttribute('aria-label',messages[lang].guideSections);
  $('#language').setAttribute('aria-label',messages[lang].languageLabel||(lang==='fr'?'Langue':lang==='de'?'Sprache':'Language'));
  clearBookingError();
  document.querySelectorAll('.stay-card a').forEach(anchor=>{const match=new URL(anchor.href).pathname.match(/\/stays\/([a-z0-9-]+)\//);if(match)anchor.href=`/${lang==='en'?'':lang+'/'}stays/${match[1]}/`;});
  $('[data-i18n="allStays"]').href=`/${lang==='en'?'':lang+'/'}all-stays/`;
  syncSearchSelection();
  renderGuide();renderFilterStatus();
  if($('#booking-dialog').open)renderSelection();
}
$('#language').addEventListener('change',e=>setLanguage(e.target.value));
$('#check-in').addEventListener('change',()=>{if(validDate($('#check-in').value))$('#check-out').min=nextDate($('#check-in').value);clearBookingError();syncSearchSelection();});
$('#check-out').addEventListener('change',()=>{clearBookingError();syncSearchSelection();});
$('#guests').addEventListener('change',syncSearchSelection);
function renderSelection(){
  syncSearchSelection();
  $('#booking-handoff').href=window.JADORE_SELECTION.urlFor('https://jadore-montreux.holidayfuture.com/search',window.JADORE_SELECTION.get());
  const fmt=new Intl.DateTimeFormat(lang,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  $('#selection-summary').textContent=messages[lang].selection(fmt.format(new Date($('#check-in').value+'T12:00:00Z')),fmt.format(new Date($('#check-out').value+'T12:00:00Z')),Number($('#guests').value));
}
$('#booking-form').addEventListener('submit',e=>{
  e.preventDefault();const a=$('#check-in').value,b=$('#check-out').value;let error='';let target='#check-in';
  if(!validDate(a)||!validDate(b)){error=messages[lang].missing;target=!validDate(a)?'#check-in':'#check-out';}
  else if(a<todayZurich())error=messages[lang].past;
  else if(b<=a){error=messages[lang].order;target='#check-out';}
  $('#booking-error').textContent=error;$('#check-in').removeAttribute('aria-invalid');$('#check-out').removeAttribute('aria-invalid');
  if(error){$(target).setAttribute('aria-invalid','true');$(target).focus();return;}
  renderSelection();$('#booking-dialog').showModal();
});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();}));
$('.menu-toggle').addEventListener('click',()=>{const open=!$('#main-nav').classList.contains('open');$('#main-nav').classList.toggle('open',open);$('.menu-toggle').setAttribute('aria-expanded',String(open));});
$('#main-nav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#main-nav').classList.remove('open');$('.menu-toggle').setAttribute('aria-expanded','false');}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});document.querySelectorAll('.stay-card').forEach(card=>card.hidden=button.dataset.filter!=='all'&&card.dataset.type!==button.dataset.filter);renderFilterStatus();}));
function renderFilterStatus(){const n=document.querySelectorAll('.stay-card:not([hidden])').length;$('#stay-results').textContent=lang==='zh'?`${n} 处住宿已显示`:lang==='es'?`${n} alojamientos mostrados`:lang==='fr'?`${n} hébergements affichés`:lang==='de'?`${n} Unterkünfte angezeigt`:`${n} stays shown`;}
function renderGuide(){
  const m=messages[lang],officialLocale=['en','fr','de'].includes(lang)?lang:'en';const panel=$('#guide-panel');panel.replaceChildren();const content=document.createElement('div');content.className='guide-panel-content';
  const el=(tag,text,className)=>{const x=document.createElement(tag);x.textContent=text;if(className)x.className=className;return x;};
  if(guideSection==='checklist'){content.append(el('h3',m.checklistTitle));const list=el('ul','');m.checklist.forEach(item=>list.append(el('li',item)));content.append(list,el('span',m.status,'guide-status'),el('p',m.help,'small-note'));}
  if(guideSection==='tax'){content.append(el('p',m.taxLabel,'tax-example-label'),el('h3',m.taxTitle),el('p',m.taxIntro));[[m.regional+' · '+m.calculation,'CHF 18'],[m.communal+' · '+m.calculation,'CHF 18'],[m.taxTotal,'CHF 36']].forEach(([label,amount],i)=>{const row=el('div','','tax-row'+(i===2?' total':''));row.append(el('span',label),el('span',amount));content.append(row);});content.append(el('p',m.taxFoot,'small-note'));}
  if(guideSection==='local'){content.append(el('h3',m.localTitle),el('p',m.localIntro));const list=el('ul','');[`https://www.montreuxriviera.com/${officialLocale}/`,`https://www.montreuxriviera.com/${officialLocale}/PA372/montreux-riviera-card`,`https://www.sbb.ch/${officialLocale}`].forEach((url,i)=>{const li=el('li','');const a=el('a',m.links[i]+(officialLocale!==lang?' (EN)':'')+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);});content.append(list,el('p',m.localFoot,'small-note'));}
  panel.append(content);
}
$('#guide-open').addEventListener('click',()=>{renderGuide();$('#guide-dialog').showModal();});
$('#privacy-open').addEventListener('click',()=>$('#privacy-dialog').showModal());
document.querySelectorAll('[data-guide]').forEach(button=>button.addEventListener('click',()=>{guideSection=button.dataset.guide;document.querySelectorAll('[data-guide]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderGuide();}));
renderGuide();

renderFilterStatus();
