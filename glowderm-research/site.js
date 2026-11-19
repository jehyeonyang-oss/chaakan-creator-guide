'use strict';
const $ = selector => document.querySelector(selector);
let references = [];
let brand = '', topic = '', search = '', mode = 'visual';
const topics = ['레티날','주름·탄력','볼 꺼짐','땅콩형','30대 노처녀','주름','중안부 탄력','탄력','흔적','수면 톤업','시술 연출','화장 끼임','화장 들뜸','건조함'];
const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function setView(){
  const hash=location.hash.slice(1);
  const view=['research','keywords','scenes','formats'].includes(hash)?'research':'library';
  document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==view);
  document.querySelectorAll('[data-tab]').forEach(el=>{
    if(el.dataset.tab===view) el.setAttribute('aria-current','page');
    else el.removeAttribute('aria-current');
  });
  if(hash.startsWith('ref-') && references.length) openDetail(hash.slice(4));
  if(['keywords','scenes','formats'].includes(hash)) document.getElementById(hash).scrollIntoView({block:'start'});
}

function controls(){
  const pool=references.filter(r=>mode==='visual'?Boolean(r.thumb):true);
  const brands=[...new Set(pool.map(r=>r.brand))];
  $('#brand-total').textContent=brands.filter(b=>b!=='브랜드 미확인').length+'개';
  $('#brand-list').innerHTML=[['', '전체 브랜드'],...brands.map(b=>[b,b])].map(([value,label])=>`<button class="brand-button" type="button" data-brand="${escapeHtml(value)}" aria-pressed="${brand===value}">${escapeHtml(label)}<span>${pool.filter(r=>!value||r.brand===value).length}</span></button>`).join('');
  document.querySelectorAll('[data-mode]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.mode===mode));button.textContent=(button.dataset.mode==='visual'?'이미지·영상':'전체 키워드')+' '+references.filter(r=>button.dataset.mode==='visual'?Boolean(r.thumb):true).length;});
  $('#topic-list').innerHTML=['',...topics].map(value=>`<button class="topic-button" type="button" data-topic="${escapeHtml(value)}" aria-pressed="${topic===value}">${value||'전체 소구'}</button>`).join('');
}

function render(){
  const matching=references.filter(r=>(mode==='visual'?Boolean(r.thumb):true)&&(!brand||r.brand===brand)&&(!topic||r.tags.includes(topic))&&(!search||[r.brand,r.title,r.account,r.scene,...r.keywords,...r.tags].join(' ').toLocaleLowerCase().includes(search)));
  $('#results-heading').textContent=brand||'전체 레퍼런스';
  $('#result-count').textContent=`${matching.length}개의 레퍼런스${topic?' · '+topic:''}`;
  $('#empty').hidden=matching.length>0;
  const brands=[...new Set(matching.map(r=>r.brand))];
  $('#reference-list').innerHTML=brands.map(b=>{
    const rows=matching.filter(r=>r.brand===b);
    const counts=new Map();rows.forEach(r=>new Set(r.keywords).forEach(k=>counts.set(k,(counts.get(k)||0)+1)));
    const keywords=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k])=>k);
    return `<section class="brand-section"><h3 class="group-title">${escapeHtml(b)}<span>${rows.length}개의 레퍼런스</span></h3><div class="brand-keywords"><strong>주요 키워드</strong><div>${keywords.map(k=>`<span>${escapeHtml(k)}</span>`).join('')}</div></div><div class="card-grid ${mode==='visual'?'':'keyword-only-grid'}">${rows.map(cardMarkup).join('')}</div></section>`;
  }).join('');
}

function cardMarkup(r){
  const visual=mode==='visual'&&r.thumb?`<div class="card-image"><img src="${r.thumb}" alt="${escapeHtml(r.brand+' · '+r.keywords.join(' · '))}" loading="lazy" width="400" height="520"></div>`:'';
  const scene=mode==='visual'&&r.scene?`<p class="card-scene"><strong>연출</strong> ${escapeHtml(r.scene)}</p>`:'';
  return `<article class="ref-card ${visual?'':'copy-card'}"><button class="card-open" type="button" data-reference="${r.id}"><div class="card-copy"><div class="card-tags"><span>${escapeHtml(r.brand)}</span><span>${escapeHtml(r.product)}</span>${r.tags.includes('주름·탄력')?'<span>주름·탄력</span>':''}</div><h4 class="card-keywords">${r.keywords.map(k=>`<span>${escapeHtml(k)}</span>`).join('')}</h4></div>${visual}${scene}</button><div class="card-bottom"><span>${r.capture?'장면·캡처 보기':'키워드 상세'}</span><a href="${escapeHtml(r.source)}" target="_blank" rel="noopener">${escapeHtml(r.source_label||'원본')} ↗</a></div></article>`;
}

function openDetail(id){
  const r=references.find(item=>item.id===id);
  if(!r) return;
  $('#detail-brand').textContent=r.brand;
  $('#detail-title').textContent=r.brand+' · '+r.product;
  $('#detail-tags').textContent=r.tags.join(' · ');
  $('#detail-account').textContent='게시 계정: '+r.account;
  $('#detail-description').textContent=r.scene||'';
  $('#detail-description').hidden=!r.scene;
  $('#detail-description-label').hidden=!r.scene;
  $('#detail-description-label').textContent='장면에서 볼 것';
  $('#detail-keywords').innerHTML=r.keywords.map(k=>`<span>${escapeHtml(k)}</span>`).join('');
  $('.detail-visual').hidden=!r.thumb;
  $('.dialog-body').classList.toggle('no-visual',!r.thumb);
  if(r.thumb) $('#detail-thumb').src=r.thumb; else $('#detail-thumb').removeAttribute('src');
  $('#detail-thumb').alt=r.title;
  $('#detail-media').href=r.media;
  $('#detail-source').href=r.source;
  $('#detail-source').textContent=(r.source_label||'광고 원본 페이지')+' ↗';
  $('.capture').hidden=!r.capture;
  if(r.capture) $('#detail-capture').src=r.capture; else $('#detail-capture').removeAttribute('src');
  $('.capture').open=true;
  if(!$('#detail').open) $('#detail').showModal();
}
function reset(){brand='';topic='';search='';$('#search').value='';controls();render();}
document.querySelector('.library-modes').addEventListener('click',event=>{const button=event.target.closest('[data-mode]');if(!button)return;mode=button.dataset.mode;reset();});
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
window.addEventListener('hashchange',()=>{setView();if(['#library','#research'].includes(location.hash))window.scrollTo({top:0});});
setView();
try {
  references=JSON.parse($('#reference-data').textContent);controls();render();setView();
} catch {
  $('#result-count').textContent='자료를 불러오지 못했습니다. 새로고침하거나 BP 누적 시트를 열어주세요.';
}
