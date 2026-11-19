'use strict';
const atlas=JSON.parse(document.querySelector('#bp-keyword-data').textContent);
const atlasCategories=['시술 용어','주름·탄력','흔적·여드름 자국','시술 비교·홈케어','성분·기술','수분·광·화잘먹','나이·상황','복합 기능·미백','표현 변형'];
const atlasEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let atlasCategory='',atlasBrand='',atlasQuery='';
const atlasBrands=[...new Set(atlas.flatMap(r=>r.brands))].sort((a,b)=>a.localeCompare(b,'ko'));
document.querySelector('#atlas-brand').innerHTML='<option value="">전체 브랜드</option>'+atlasBrands.map(b=>`<option>${atlasEscape(b)}</option>`).join('');
document.querySelector('#atlas-categories').innerHTML=['',...atlasCategories].map(c=>`<button type="button" class="topic-button" data-atlas-category="${c}" aria-pressed="${!c}">${c||'핵심 키워드'}</button>`).join('');
function renderAtlas(){
  const rows=atlas.filter(r=>(atlasCategory?r.category===atlasCategory:(r.category!=='표현 변형'||atlasQuery))&&(!atlasBrand||r.brands.includes(atlasBrand))&&(!atlasQuery||atlasQuery.split(/\s+/).every(q=>[r.word,r.word.replace('자국/흔적','흔적'),...r.brands].join(' ').replace(/\s/g,'').toLowerCase().includes(q.replace(/\s/g,'')))));
  document.querySelector('#atlas-count').textContent=`${rows.length}개 키워드`;
  document.querySelector('#atlas-results').innerHTML=atlasCategories.map(category=>{
    const items=rows.filter(r=>r.category===category);if(!items.length)return '';
    return `<section class="atlas-group"><h2>${category}</h2><div class="atlas-grid">${items.map(r=>{
      const norm=s=>s.replace(/\s/g,'').toLowerCase();
      const linked=references.filter(ref=>r.brands.includes(ref.brand)&&ref.keywords.some(k=>norm(k).includes(norm(r.word)))).filter((ref,i,all)=>all.findIndex(other=>other.brand===ref.brand)===i).slice(0,3);
      return `<article class="atlas-card"><h3>${atlasEscape(r.word)}</h3>${r.ad_count===0?'<p class="atlas-candidate">탐색 후보 · 시트 내 사용 사례 0건</p>':`<div class="atlas-brands">${r.brands.map(b=>`<span>${atlasEscape(b)}</span>`).join('')}</div>`}<div class="atlas-links">${linked.map(ref=>`<button type="button" data-reference="${ref.id}">${atlasEscape(ref.brand)} 광고 보기 ↗</button>`).join('')}<a href="${r.source}" target="_blank" rel="noopener">시트 근거 ↗</a></div></article>`;
    }).join('')}</div></section>`;
  }).join('')||'<p class="empty">일치하는 키워드가 없습니다.</p>';
}
document.querySelector('#atlas-categories').addEventListener('click',e=>{const b=e.target.closest('[data-atlas-category]');if(!b)return;atlasCategory=b.dataset.atlasCategory;document.querySelectorAll('[data-atlas-category]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));renderAtlas();});
document.querySelector('#atlas-brand').addEventListener('change',e=>{atlasBrand=e.target.value;renderAtlas();});
document.querySelector('#atlas-search').addEventListener('input',e=>{atlasQuery=e.target.value.trim().toLowerCase();renderAtlas();});
renderAtlas();
