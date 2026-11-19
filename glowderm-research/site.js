'use strict';
const $ = selector => document.querySelector(selector);
let references = [];
let brand = '', topic = '', search = '';
const topics = ['레티날','주름','중안부 탄력','탄력','흔적','수면 톤업','시술 연출','화장 끼임'];
const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function setView(){
  const hash=location.hash.slice(1);
  const view=['keywords','scenes','formats'].includes(hash)?'research':(['research','scripts'].includes(hash)?hash:'library');
  document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==view);
  document.querySelectorAll('[data-tab]').forEach(el=>{
    if(el.dataset.tab===view) el.setAttribute('aria-current','page');
    else el.removeAttribute('aria-current');
  });
  if(hash.startsWith('ref-') && references.length) openDetail(hash.slice(4));
  if(['keywords','scenes','formats'].includes(hash)) document.getElementById(hash).scrollIntoView({block:'start'});
}

function controls(){
  const brands=[...new Set(references.map(r=>r.brand))];
  $('#brand-total').textContent=brands.filter(b=>b!=='브랜드 미확인').length+'개';
  $('#brand-list').innerHTML=[['', '전체 브랜드'],...brands.map(b=>[b,b])].map(([value,label])=>`<button class="brand-button" type="button" data-brand="${escapeHtml(value)}" aria-pressed="${brand===value}">${escapeHtml(label)}<span>${references.filter(r=>!value||r.brand===value).length}</span></button>`).join('');
  $('#topic-list').innerHTML=['',...topics].map(value=>`<button class="topic-button" type="button" data-topic="${escapeHtml(value)}" aria-pressed="${topic===value}">${value||'전체 소구'}</button>`).join('');
}

function render(){
  const matching=references.filter(r=>(!brand||r.brand===brand)&&(!topic||r.tags.includes(topic))&&(!search||[r.brand,r.title,r.account,r.description,r.quote,r.scene,...r.keywords,...r.tags].join(' ').toLocaleLowerCase().includes(search)));
  $('#results-heading').textContent=brand||'전체 레퍼런스';
  $('#result-count').textContent=`${matching.length}개의 레퍼런스${topic?' · '+topic:''}`;
  $('#empty').hidden=matching.length>0;
  const brands=[...new Set(matching.map(r=>r.brand))];
  $('#reference-list').innerHTML=brands.map(b=>{
    const rows=matching.filter(r=>r.brand===b);
    const keywords=[...new Set(rows.flatMap(r=>r.keywords))];
    return `<section class="brand-section"><h3 class="group-title">${escapeHtml(b)}<span>${rows.length}개의 레퍼런스</span></h3><p class="brand-keywords"><strong>핵심 키워드</strong> ${keywords.map(escapeHtml).join(' · ')}</p><div class="card-grid">${rows.map(r=>`<article class="ref-card"><button class="card-open" type="button" data-reference="${r.id}"><div class="card-image"><img src="${r.thumb}" alt="${escapeHtml(r.title)}" loading="lazy" width="400" height="520"></div><div class="card-copy"><div class="card-tags"><span>${escapeHtml(r.product)}</span><span>${escapeHtml(r.claim)}</span></div><h4>${escapeHtml(r.quote)}</h4><p class="quote-label">${escapeHtml(r.quote_source||'광고에 사용된 표현')}</p><p class="card-scene"><strong>연출</strong> ${escapeHtml(r.scene)}</p></div></button><div class="card-bottom"><span>장면·캡처 보기</span><a href="${escapeHtml(r.source)}" target="_blank" rel="noopener" aria-label="${escapeHtml(r.title+' 원본 열기')}">원본 ↗</a></div></article>`).join('')}</div></section>`;
  }).join('');
}

function openDetail(id){
  const r=references.find(item=>item.id===id);
  if(!r) return;
  $('#detail-brand').textContent=r.brand;
  $('#detail-title').textContent=r.title;
  $('#detail-tags').textContent=r.tags.join(' · ');
  $('#detail-account').textContent='게시 계정: '+r.account;
  $('#detail-description').textContent=r.scene;
  $('#detail-quote').textContent=r.quote;
  $('#detail-quote-label').textContent=r.quote_source||'광고에 사용된 표현';
  $('#detail-thumb').src=r.thumb;
  $('#detail-thumb').alt=r.title;
  $('#detail-media').href=r.media;
  $('#detail-source').href=r.source;
  $('#detail-capture').src=r.capture;
  $('.capture').open=false;
  if(!$('#detail').open) $('#detail').showModal();
}
function reset(){brand='';topic='';search='';$('#search').value='';controls();render();}
$('#brand-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-brand]');if(!button)return;
  brand=button.dataset.brand;
  document.querySelectorAll('[data-brand]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brand===brand)));
  render();
});
$('#topic-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-topic]');if(!button)return;
  topic=button.dataset.topic;
  document.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic)));
  render();
});
$('#search').addEventListener('input',event=>{search=event.target.value.trim().toLocaleLowerCase();render();});
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-reference]');
  if(target){event.preventDefault();openDetail(target.dataset.reference);}
});
$('#reset').addEventListener('click',reset);
$('#empty-reset').addEventListener('click',reset);
$('#close-detail').addEventListener('click',()=>$('#detail').close());
$('#detail').addEventListener('click',event=>{if(event.target===$('#detail')){const box=$('#detail').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)$('#detail').close();}});
window.addEventListener('hashchange',()=>{setView();if(['#library','#research','#scripts'].includes(location.hash))window.scrollTo({top:0});});
setView();
try {
  references=JSON.parse($('#reference-data').textContent);controls();render();setView();
} catch {
  $('#result-count').textContent='자료를 불러오지 못했습니다. 새로고침하거나 BP 누적 시트를 열어주세요.';
}
