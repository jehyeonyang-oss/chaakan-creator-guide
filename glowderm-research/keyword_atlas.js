'use strict';
const atlas=JSON.parse(document.querySelector('#bp-keyword-data').textContent);
const atlasCategories=['시술 용어','주름·탄력','흔적·여드름 자국','시술 비교·홈케어','성분·기술','수분·광·화잘먹','나이·상황','복합 기능·미백','표현 변형'];
const atlasEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const atlasNumber=value=>value==null?'—':Number(value).toLocaleString('ko-KR',{maximumFractionDigits:1});
const atlasOrders={frequency:['ad_count','많이 사용된 순'],max:['max_days','최장 집행일수 순'],median:['median_days','집행일수 중앙값 순'],long:['ads_30d','30일 이상 집행 광고 수 순']};
let atlasCategory='',atlasBrand='',atlasQuery='',atlasSort='frequency';
const atlasBrands=[...new Set(atlas.flatMap(r=>r.brands))].sort((a,b)=>a.localeCompare(b,'ko'));
document.querySelector('#atlas-brand').innerHTML='<option value="">전체 브랜드</option>'+atlasBrands.map(b=>`<option>${atlasEscape(b)}</option>`).join('');
document.querySelector('#atlas-categories').innerHTML=['',...atlasCategories].map(c=>`<button type="button" class="topic-button" data-atlas-category="${c}" aria-pressed="${!c}">${c||'핵심 키워드'}</button>`).join('');
function atlasSorted(rows,field){return [...rows].sort((a,b)=>(b[field]??-1)-(a[field]??-1)||b.ad_count-a.ad_count||a.word.localeCompare(b.word,'ko'));}
function atlasCard(r){
  const norm=s=>s.replace(/\s/g,'').toLowerCase();
  const linked=references.filter(ref=>r.brands.includes(ref.brand)&&ref.keywords.some(k=>norm(k).includes(norm(r.word)))).filter((ref,i,all)=>all.findIndex(other=>other.brand===ref.brand)===i).slice(0,3);
  const metric=(label,value,unit)=>`<div><dt>${label}</dt><dd>${atlasNumber(value)}${value==null?'':`<small>${unit}</small>`}</dd></div>`;
  return `<article class="atlas-card" data-word="${atlasEscape(r.word)}" data-count="${r.ad_count}" data-max="${r.max_days??''}" data-median="${r.median_days??''}" data-long="${r.ads_30d}"><p class="atlas-category-label">${r.category} · ${r.brand_count}개 브랜드</p><h3>${atlasEscape(r.word)}</h3><dl class="atlas-metrics">${metric('사용 광고',r.ad_count,'개')}${metric('최장 집행',r.max_days,'일')}${metric('집행 중앙값',r.median_days,'일')}${metric('30일 이상 집행',r.ads_30d,'개')}</dl>${r.ad_count===0?'<p class="atlas-candidate">탐색 후보 · 시트 내 사용 사례 0건</p>':`<div class="atlas-brands">${r.brands.map(b=>`<span>${atlasEscape(b)}</span>`).join('')}</div>`}<div class="atlas-links">${linked.map(ref=>`<button type="button" data-reference="${ref.id}">${atlasEscape(ref.brand)} 광고 보기 ↗</button>`).join('')}<a href="${r.source}" target="_blank" rel="noopener">시트 근거 ↗</a></div></article>`;
}
function renderAtlas(){
  const rows=atlas.filter(r=>(atlasCategory?r.category===atlasCategory:(r.category!=='표현 변형'||atlasQuery))&&(!atlasBrand||r.brands.includes(atlasBrand))&&(!atlasQuery||atlasQuery.split(/\s+/).every(q=>[r.word,r.word.replace('자국/흔적','흔적'),...r.brands].join(' ').replace(/\s/g,'').toLowerCase().includes(q.replace(/\s/g,'')))));
  document.querySelector('#atlas-count').textContent=`${rows.length}개 키워드`;
  document.querySelector('#atlas-rank-scope').textContent=[atlasBrand?`${atlasBrand}가 사용하는 키워드 · 수치는 전체 브랜드 합산`:'전체 브랜드',atlasCategory||'핵심 키워드',atlasQuery?`검색: ${atlasQuery}`:''].filter(Boolean).join(' · ');
  document.querySelector('#atlas-metric-scope').textContent=atlasBrand?`${atlasBrand}가 사용하는 키워드만 골랐습니다. 수치는 해당 브랜드 단독 실적이 아닌 전체 브랜드 합산 집계입니다.`:'수치는 BP 시트의 전체 브랜드 합산 집계입니다.';
  document.querySelector('#atlas-leaders').innerHTML=[['ad_count','가장 많이 사용','개'],['max_days','가장 긴 집행 기록','일'],['median_days','집행 중앙값이 긴 키워드','일']].map(([field,title,unit])=>{
    const leaders=atlasSorted(rows.filter(r=>r.ad_count>0&&r[field]!=null),field).slice(0,5);
    return `<article class="atlas-leader" data-metric="${field}"><h3>${title}</h3><ol>${leaders.map(r=>`<li><button type="button" data-atlas-word="${atlasEscape(r.word)}"><span>${atlasEscape(r.word)}<small>${field==='ad_count'?`${r.brand_count}개 브랜드`:`사용 광고 ${atlasNumber(r.ad_count)}개`}</small></span><strong>${atlasNumber(r[field])}<small>${unit}</small></strong></button></li>`).join('')}</ol>${leaders.length?'':'<p>일치하는 키워드가 없습니다.</p>'}</article>`;
  }).join('');
  const groups=atlasSort==='category'?atlasCategories.map(category=>[category,atlasSorted(rows.filter(r=>r.category===category),'ad_count')]):[[atlasOrders[atlasSort][1],atlasSorted(rows,atlasOrders[atlasSort][0])]];
  document.querySelector('#atlas-results').innerHTML=groups.filter(([,items])=>items.length).map(([title,items])=>`<section class="atlas-group"><h2>${title}</h2><div class="atlas-grid">${items.map(atlasCard).join('')}</div></section>`).join('')||'<p class="empty">일치하는 키워드가 없습니다.</p>';
}
document.querySelector('#atlas-categories').addEventListener('click',e=>{const b=e.target.closest('[data-atlas-category]');if(!b)return;atlasCategory=b.dataset.atlasCategory;document.querySelectorAll('[data-atlas-category]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));renderAtlas();});
document.querySelector('#atlas-brand').addEventListener('change',e=>{atlasBrand=e.target.value;renderAtlas();});
document.querySelector('#atlas-sort').addEventListener('change',e=>{atlasSort=e.target.value;renderAtlas();});
document.querySelector('#atlas-search').addEventListener('input',e=>{atlasQuery=e.target.value.trim().toLowerCase();renderAtlas();});
document.querySelector('#atlas-leaders').addEventListener('click',e=>{const b=e.target.closest('[data-atlas-word]');if(!b)return;atlasQuery=b.dataset.atlasWord.toLowerCase();document.querySelector('#atlas-search').value=b.dataset.atlasWord;renderAtlas();location.hash='keyword-atlas';document.querySelector('#keyword-atlas').scrollIntoView({block:'start'});});
renderAtlas();
