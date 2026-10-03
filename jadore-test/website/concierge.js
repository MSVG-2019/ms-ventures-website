'use strict';
const conciergeEnabled=window.JADORE_CONCIERGE?.enabled===true;
const conciergeDialog=document.querySelector('#concierge-dialog');
const conciergePanel=document.querySelector('#concierge-answer');
const conciergeStatus=document.querySelector('#concierge-status');
let publicKnowledge;
let conciergeRequestGeneration=0;
let activeConciergeRequest;
const conciergeSubmitButton=document.querySelector('#concierge-form button');
// Public provenance is reviewed independently from navigation parameters. New
// sources or entry categories require a deliberate catalog/allowlist review.
const conciergeApprovedSources=Object.freeze({
  booking:'https://jadore-montreux.holidayfuture.com/all-listings',
  'montreux-tax':'https://www.montreux.ch/habiter-et-decouvrir/tourisme',
  'riviera-card':'https://www.montreuxriviera.com/en/PA372/montreux-riviera-card',
  escape:'https://jadore-montreux.holidayfuture.com/listings/157813',
  downtown:'https://jadore-montreux.holidayfuture.com/listings/130594',
  room:'https://jadore-montreux.holidayfuture.com/listings/130600',
  host:'https://jadore-montreux.holidayfuture.com/contact-us'
});
const conciergeApprovedEntryIds=Object.freeze(['choose_stay','taxes','riviera_card','arrival','parking','booking','host_help']);
const conciergeCopy={en:{loading:'One moment…',failure:'The concierge is unavailable. Please contact our team.',sample:'VERIFIED ANSWER · PREVIEW',ai:'AI-ASSISTED ANSWER',fallback:'PLEASE CONTACT YOUR HOST',notice:'This AI concierge answers public travel questions using approved information. Questions are sent to our Azure AI service. Do not share personal information or reservation details.'},fr:{loading:'Un instant…',failure:'Le concierge est indisponible. Contactez notre équipe.',sample:'RÉPONSE VÉRIFIÉE · APERÇU',ai:'RÉPONSE ASSISTÉE PAR IA',fallback:'CONTACTEZ VOTRE HÔTE',notice:'Ce concierge IA répond aux questions publiques avec des informations approuvées. Les questions sont envoyées à notre service Azure AI. Ne partagez aucune donnée personnelle ni référence de réservation.'},de:{loading:'Einen Moment…',failure:'Der Concierge ist nicht verfügbar. Kontaktieren Sie unser Team.',sample:'GEPRÜFTE ANTWORT · VORSCHAU',ai:'KI-GESTÜTZTE ANTWORT',fallback:'KONTAKTIEREN SIE IHREN GASTGEBER',notice:'Dieser KI-Concierge beantwortet öffentliche Reisefragen anhand freigegebener Informationen. Fragen werden an unseren Azure-AI-Dienst gesendet. Teilen Sie keine persönlichen Daten oder Buchungsdetails.'}};
Object.assign(conciergeCopy,{"es":{"loading":"Un momento…","failure":"El concierge no está disponible. Contacte con nuestro equipo.","sample":"RESPUESTA VERIFICADA · VISTA PREVIA","ai":"RESPUESTA CON AYUDA DE IA","fallback":"CONTACTE CON SU ANFITRIÓN","notice":"Este concierge con IA responde a preguntas públicas sobre viajes utilizando información aprobada. Las preguntas se envían a nuestro servicio Azure AI. No comparta datos personales ni detalles de su reserva."},"zh":{"loading":"请稍候…","failure":"礼宾服务暂时无法使用。请联系我们的团队。","sample":"经核实的回答 · 预览","ai":"AI 辅助回答","fallback":"请联系您的房东","notice":"这个 AI 礼宾服务依据经批准的信息，回答公开旅行问题。问题将发送到我们的 Azure AI 服务。请勿分享个人资料或私人预订信息。"}});
// Browser translation may alter html.lang; the visitor’s explicit language choice owns this flow.
const conciergeLanguage=()=>{const chosen=document.querySelector('#language').value||document.documentElement.lang;return ['en','fr','de','es','zh'].includes(chosen)?chosen:'en';};
function cancelConciergeRequest(){
  conciergeRequestGeneration++;
  if(activeConciergeRequest){activeConciergeRequest.controller.abort();clearTimeout(activeConciergeRequest.timer);activeConciergeRequest=undefined;}
  conciergeSubmitButton.disabled=false;
}
function resetConciergeAnswer(){conciergePanel.hidden=true;conciergePanel.replaceChildren();conciergeStatus.textContent='';}
function beginConciergeRequest(disableSubmit=false){
  cancelConciergeRequest();resetConciergeAnswer();
  const request={generation:conciergeRequestGeneration,language:conciergeLanguage(),controller:new AbortController()};
  request.timer=setTimeout(()=>request.controller.abort(),23000);
  activeConciergeRequest=request;conciergeSubmitButton.disabled=disableSubmit;
  conciergeStatus.textContent=conciergeCopy[request.language].loading;
  return request;
}
function currentConciergeRequest(request){return activeConciergeRequest===request&&request.generation===conciergeRequestGeneration&&request.language===conciergeLanguage()&&conciergeDialog.open;}
function finishConciergeRequest(request){clearTimeout(request.timer);if(activeConciergeRequest===request){activeConciergeRequest=undefined;conciergeSubmitButton.disabled=false;}}
function checkConciergeAbort(request){if(request.controller.signal.aborted)throw new Error('request aborted');}
function validatePublicKnowledge(catalog){
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const nonempty=value=>typeof value==='string'&&value.trim().length>0;
  const exactKeys=(value,keys)=>record(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  if(!exactKeys(catalog,['version','reviewed','scope','sources','entries'])||!nonempty(catalog.version)||!nonempty(catalog.scope)||!/^\d{4}-\d{2}-\d{2}$/.test(catalog.reviewed))throw new Error('invalid catalog');
  const reviewed=new Date(catalog.reviewed+'T00:00:00Z');
  if(Number.isNaN(reviewed.getTime())||reviewed.toISOString().slice(0,10)!==catalog.reviewed)throw new Error('invalid review date');
  if(!Array.isArray(catalog.sources)||catalog.sources.length!==Object.keys(conciergeApprovedSources).length||!Array.isArray(catalog.entries)||catalog.entries.length!==conciergeApprovedEntryIds.length)throw new Error('incomplete catalog');
  const sourceIds=new Set();
  for(const source of catalog.sources){
    if(!exactKeys(source,['id','title','url'])||!nonempty(source.id)||!nonempty(source.title)||!nonempty(source.url)||!Object.hasOwn(conciergeApprovedSources,source.id)||sourceIds.has(source.id))throw new Error('invalid source');
    const url=new URL(source.url),expected=new URL(conciergeApprovedSources[source.id]);
    if(url.protocol!=='https:'||url.username||url.password||url.origin!==expected.origin||url.pathname!==expected.pathname||url.search||url.hash||source.url!==expected.href)throw new Error('unapproved source URL');
    sourceIds.add(source.id);
  }
  const entryIds=new Set();
  for(const entry of catalog.entries){
    if(!exactKeys(entry,['id','topic','answers','source_ids'])||!conciergeApprovedEntryIds.includes(entry.id)||entryIds.has(entry.id)||!nonempty(entry.topic)||!exactKeys(entry.answers,['en','fr','de','es','zh'])||!Object.values(entry.answers).every(nonempty)||!Array.isArray(entry.source_ids)||entry.source_ids.length===0||new Set(entry.source_ids).size!==entry.source_ids.length||!entry.source_ids.every(id=>typeof id==='string'&&sourceIds.has(id)))throw new Error('invalid entry');
    entryIds.add(entry.id);
  }
  // A canceled or malformed response never becomes the shared cached catalog.
  // Freeze the validated parsed data so later render paths cannot mutate it.
  catalog.sources.forEach(Object.freeze);
  catalog.entries.forEach(entry=>{Object.freeze(entry.answers);Object.freeze(entry.source_ids);Object.freeze(entry);});
  Object.freeze(catalog.sources);Object.freeze(catalog.entries);
  return Object.freeze(catalog);
}
async function loadPublicKnowledge(request){
  if(!publicKnowledge){const result=await fetch('/public-knowledge.json',{cache:'no-store',signal:request.controller.signal});if(!result.ok)throw new Error('catalog unavailable');const catalog=await result.json();checkConciergeAbort(request);publicKnowledge=validatePublicKnowledge(catalog);}
  return publicKnowledge;
}
function approvedConciergeAnswer(catalog,id,language){
  const entry=catalog.entries.find(x=>x.id===id);
  if(!entry||typeof entry.answers?.[language]!=='string'||!Array.isArray(entry.source_ids))throw new Error('invalid answer');
  const sources=entry.source_ids.map(id=>catalog.sources.find(x=>x.id===id));
  if(sources.some(x=>!x||typeof x.title!=='string'||typeof x.url!=='string'))throw new Error('invalid sources');
  return {answer:entry.answers[language],sources};
}
function showConciergeAnswer(value,mode,locale){
  const copy=conciergeCopy[locale];
  conciergePanel.replaceChildren();
  const label=document.createElement('p');label.className='tax-example-label';label.textContent=mode==='preview'?copy.sample:mode==='ai_routed'?copy.ai:copy.fallback;
  const answer=document.createElement('p');answer.textContent=value.answer;
  conciergePanel.append(label,answer);
  for(const source of value.sources){const a=document.createElement('a');a.textContent=source.title+' ↗';a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';conciergePanel.append(a);}
  conciergePanel.hidden=false;conciergeStatus.textContent='';
}
document.querySelector('#concierge-open').addEventListener('click',()=>{cancelConciergeRequest();resetConciergeAnswer();conciergeDialog.showModal();});
// Native close events are queued. An earlier close must not cancel work started
// after the same dialog has already been reopened.
conciergeDialog.addEventListener('close',()=>{if(!conciergeDialog.open){cancelConciergeRequest();resetConciergeAnswer();}});
document.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',async()=>{
  const request=beginConciergeRequest();
  try{const catalog=await loadPublicKnowledge(request);if(!currentConciergeRequest(request))return;checkConciergeAbort(request);
    showConciergeAnswer(approvedConciergeAnswer(catalog,button.dataset.answer,request.language),'preview',request.language);
  }catch{if(currentConciergeRequest(request))conciergeStatus.textContent=conciergeCopy[request.language].failure;}
  finally{finishConciergeRequest(request);}
}));
function updateConciergeMode(){if(conciergeEnabled){document.querySelector('#concierge-notice').textContent=conciergeCopy[conciergeLanguage()].notice;document.querySelector('#concierge-form').hidden=false;}}
document.querySelector('#language').addEventListener('change',()=>{cancelConciergeRequest();resetConciergeAnswer();updateConciergeMode();});
document.querySelector('#concierge-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!conciergeEnabled||!document.querySelector('#concierge-consent').checked)return;
  const request=beginConciergeRequest(true),question=document.querySelector('#concierge-question').value;
  try{const catalog=await loadPublicKnowledge(request);if(!currentConciergeRequest(request))return;checkConciergeAbort(request);
    const result=await fetch('/api/concierge',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:request.controller.signal,body:JSON.stringify({question,language:request.language})});
    if(!result.ok)throw new Error('unavailable');const value=await result.json();
    if(!currentConciergeRequest(request))return;checkConciergeAbort(request);
    // Render only our locally approved catalog, even if an API is misconfigured.
    if(!['ai_routed','host_handoff','fallback'].includes(value.mode))throw new Error('invalid answer');
    showConciergeAnswer(approvedConciergeAnswer(catalog,value.answer_id,request.language),value.mode,request.language);
    document.querySelector('#concierge-question').value='';
  }catch{if(currentConciergeRequest(request))conciergeStatus.textContent=conciergeCopy[request.language].failure;}
  finally{finishConciergeRequest(request);}
});
updateConciergeMode();
