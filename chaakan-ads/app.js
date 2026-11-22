(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const int = v => v == null ? '—' : Math.round(v).toLocaleString('ko-KR');
const won = v => v == null ? '—' : int(v) + '원';
const man = v => {
  if (v == null) return '—';
  if (v < 10000) return int(v) + '원';
  const x = v / 10000;
  return (x < 1000 ? x.toFixed(1) : Math.round(x).toLocaleString('ko-KR')) + '만';
};
const pct = v => v == null ? '—' : Math.round(v).toLocaleString('ko-KR') + '%';
const md = d => { const [, m, dd] = d.split('-'); return `${+m}/${+dd}`; };
const ARROW = {up: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8H1z" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 1 2h8z" fill="currentColor"/></svg>', flat: ''};
function delta(v, unit, {neutral = false, digits = 1} = {}) {
  if (v == null || !isFinite(v)) return '<span class="delta flat">—</span>';
  const dir = Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down';
  const cls = neutral ? 'flat' : dir;
  const txt = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(digits) + unit;
  const sr = dir === 'up' ? '상승' : dir === 'down' ? '하락' : '변화 없음';
  return `<span class="delta ${cls}">${ARROW[dir]}${txt}<span class="sr"> ${sr}</span></span>`;
}
const rel = (a, b) => (a == null || !b) ? null : (a - b) / b * 100;
const dpp = g => (g.r.roas == null || g.p.roas == null) ? null : g.r.roas - g.p.roas;

const CAT = {high: ['270% 이상', 'pos'], mid: ['200–270%', 'warn'], low: ['200% 미만', 'neg'], sample: ['표본 부족', 'line'], other: ['구매 목적 아님', 'info']};
const STK = {ok: ['재고 정상', ''], risk: ['사이즈 품절 주의', 'warn'], soldout: ['품절', 'neg'], unmatched: ['재고 미연결', 'line']};
const VERDICT = {budget_scale: ['예산 쏠림', 'warn'], fatigue: ['피로도', 'warn'], conversion_drop: ['전환 하락', 'neg'],
  segment_drag: ['지면 편중', 'info'], small_sample: ['표본 부족', 'line'], unclear: ['불명확', '']};
const bdg = ([t, c], title) => `<span class="bdg ${c}"${title ? ` title="${esc(title)}"` : ''}><i></i>${esc(t)}</span>`;
const PA = /시딩|파트너|(?:^|_)PA(?:_|$)/i;
const isPA = g => g.names.concat(g.camp).some(s => PA.test(s));

let D, byId = {}, state = {}, limit = 60, lastFocus = null, productViews = [];
const DEF = {q: '', acc: '', cat: '', stock: '', on: '', sort: 'spend', pa: '', view: 'card', ad: '', product: ''};
const originFor = aid => D.originals?.[aid];
const hasOriginal = g => g.ads.some(a => originFor(a)?.post || originFor(a)?.media?.length);
function originalAction(aid,group,label='원본 보기') {
  const o=originFor(aid);
  if(o?.post && !o.media?.length)return `<a class="original-open" href="${esc(o.post)}" target="_blank" rel="noopener">${label} ↗</a>`;
  return `<button type="button" class="original-open" data-original="${aid}" data-group="${group}">${label}</button>`;
}
function matchProduct(g) {
  if (!state.product) return true;
  const p = productViews.find(p => p.key === state.product); if (!p) return false;
  const ids = g.stock.p.map(String).concat(g.ads.flatMap(a => originFor(a)?.products || []));
  return p.ids.some(id => ids.includes(id));
}
function setupProducts() {
  const names = new Map();
  for (const [id, p] of Object.entries(D.products)) {
    const name = p.name.trim();
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(id);
  }
  productViews = [...names].map(([name, ids]) => ({name, ids: ids.sort((a,b)=>+a-+b), key: ids.join(',')})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  $('#product-select').innerHTML = '<option value="">전체 제품</option>' + productViews.map(p => `<option value="${p.key}">${esc(p.name)}</option>`).join('');
  const shortcuts = [{key:'',name:'전체'},...['듀마','풀문'].map(n=>productViews.find(p=>p.name.includes(n))).filter(Boolean)];
  $('#product-shortcuts').innerHTML = shortcuts.map(p=>`<button type="button" class="chip" data-product="${p.key}">${esc(p.key ? p.name.split(' ')[0] : p.name)}</button>`).join('');
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  state = Object.fromEntries(Object.keys(DEF).map(k => [k, h.get(k) ?? DEF[k]]));
}
function writeHash() {
  const h = new URLSearchParams();
  for (const k in DEF) if (state[k] && state[k] !== DEF[k]) h.set(k, state[k]);
  const s = h.toString();
  history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
}

function stockTitle(g) {
  const s = g.stock, parts = [STK[s.st][0] + (s.why ? ' — ' + s.why : '')];
  for (const p of s.p) {
    const pr = D.products[p]; if (!pr) continue;
    parts.push(`${pr.name}: ` + pr.colors.map(c => `${c.color} ${int(c.qty)}`).join(' · '));
  }
  return parts.join('\n');
}

/* 사람이 읽는 제목: 연결 상품명(없으면 코드명 첫 토큰) · 크리에이터(코드명에서 추출 가능할 때만) */
function who(n) {
  const pa = n.match(/(?:^|_)PA_([A-Za-z0-9._]+)_[^_]+$/);
  if (pa) return '@' + pa[1];
  const t = n.split('_'), i = t.indexOf('메타'), code = t[0].replace(/^ASC\S*\.\s*/, '');
  const tail = new Set(t.slice(i + 1).concat(code, '수정', '테스트', '영상', '세로', '히든'));  // 메타 뒤 = 광고 코드 약어(예: 포히)
  const skip = x => !/[가-힣]/.test(x) || /^\d+계정$/.test(x) || /^[A-Za-z]+\d*기$/.test(x) || tail.has(x);
  for (let j = i - 1; j >= 0 && j >= i - 8; j--) {
    if (skip(t[j])) continue;
    return /^[가-힣]{2,4}$/.test(t[j]) ? t[j] : '';
  }
  return '';
}
function title(g) {
  if (g._t) return g._t;
  const names = [...new Set(g.stock.p.map(p => D.products[p]?.name).filter(Boolean))];
  let prod = names.join(' + ') || g.n.replace(/^ASC\d*\.\s*/, '').split('_')[0];
  if (/1\+1/.test(g.n)) prod += ' 1+1';
  const c = who(g.n);
  return (g._t = c ? `${prod} · ${c}` : prod);
}
/* 재고 칩: stock.why(기존 판정 문구)와 품절 색상에서 그대로 뽑는다. 판정은 바꾸지 않음 */
function chips(g) {
  const s = g.stock, out = [];
  const add = (t, c) => { if (!out.some(x => x[0] === t)) out.push([t, c]); };
  for (const m of s.why.matchAll(/([^\s·/:()]+) 주력 사이즈 품절 \d+개\(([^)]+)\)/g)) add(`${m[1]} ${m[2].split(', ').join('·')} 품절`, 'warn');
  for (const m of s.why.matchAll(/총재고 (\d+) < 최근7일 구매 (\d+)×2/g)) add(`총재고 ${int(+m[1])} < 7일 구매×2`, 'warn');
  if (s.st === 'soldout') add('전체 품절', 'neg');
  for (const x of s.gone) add(`${x.split(') ').pop()} 전 사이즈 품절`, 'line');
  return out;
}
const chipHTML = (g, max = 3) => {
  const c = chips(g); if (!c.length) return '';
  const more = c.length > max ? `<span class="sc more" title="${esc(c.slice(max).map(x => x[0]).join('\n'))}">+${c.length - max}</span>` : '';
  return `<div class="schips">${c.slice(0, max).map(([t, k]) => `<span class="sc ${k}">${esc(t)}</span>`).join('')}${more}</div>`;
};
const totalStock = g => g.stock.p.reduce((t, p) => t + (D.products[p]?.total || 0), 0);

function spark(g) {
  const W = 150, H = 40, n = g.dy.length, bw = W / n;
  const maxS = Math.max(...g.dy.map(d => d[0]), 1);
  const ro = g.dy.map(d => d[0] > 0 ? d[1] / d[0] * 100 : null);
  const top = Math.min(Math.max(400, ...ro.filter(v => v != null)), 1000);
  const y = v => H - 2 - Math.min(v, top) / top * (H - 6);
  let bars = '', path = '', pen = false;
  g.dy.forEach((d, i) => {
    const h = Math.max(d[0] / maxS * (H - 4), d[0] > 0 ? 1 : 0);
    bars += `<rect class="sp-bar${i === n - 1 ? ' today' : ''}" x="${(i * bw + 1.5).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="1"/>`;
    if (ro[i] == null || i === n - 1) { pen = false; return; }
    const x = (i * bw + bw / 2).toFixed(1), yy = y(ro[i]).toFixed(1);
    path += (pen ? 'L' : 'M') + x + ' ' + yy; pen = true;
  });
  const ref = y(270).toFixed(1);
  const lbl = `일별 광고비 막대, ROAS 선. 최근 7일 ROAS ${pct(g.r.roas)}`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(lbl)}"><line class="sp-ref" x1="0" x2="${W}" y1="${ref}" y2="${ref}" vector-effect="non-scaling-stroke"/>${bars}<path class="sp-line" d="${path}" vector-effect="non-scaling-stroke"/></svg>`;
}

const SHOE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16.5V9.5c0-.6.4-1 1-1h3.2l1.6 2.6c1 1.6 2.6 2.4 4.4 2.6l5.6.6c1.4.2 2.2 1 2.2 2.2v.5c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M3 15h18" stroke="currentColor" stroke-width="1.2"/></svg>';
function thumb(g) {
  if (!g.img) return `<div class="thumb noimg"><div class="ph">${SHOE}<b>${esc(title(g).split(' · ')[0])}</b><span>이미지 없음</span></div></div>`;
  const alt = '소재 썸네일';
  if (g.img.lr) return `<div class="thumb lr"><img class="bg" src="${g.img.src}" alt="" loading="lazy" aria-hidden="true"><img class="fg" src="${g.img.src}" alt="${alt}" loading="lazy"></div>`;
  return `<div class="thumb"><img src="${g.img.src}" alt="${alt}" loading="lazy"></div>`;
}

function card(g) {
  const d = dpp(g), acc = D.accounts[g.a].name;
  return `<div class="card" role="button" tabindex="0" data-id="${g.id}" aria-label="${esc(title(g))} 상세 보기">
  <div class="card-main">${thumb(g)}
    <div class="card-info">
      <div class="badges">${bdg(CAT[g.cat])}${bdg(STK[g.stock.st], stockTitle(g))}</div>
      <h3 class="c-name">${esc(title(g))}</h3>
      <div class="c-code" title="${esc(g.n)}">${esc(g.n)}</div>
      <div class="c-sub"><span>${esc(acc)}</span><span class="dot${g.on ? ' on' : ''}">${g.on ? `집행 중 ${g.on}` : '집행 종료'}</span></div>
    </div>
  </div>
  <dl class="mets">
    <div><dt>광고비 7일</dt><dd>${man(g.r.s)}</dd></div>
    <div><dt>구매</dt><dd>${int(g.r.c)}</dd></div>
    <div><dt>ROAS</dt><dd>${pct(g.r.roas)}${d == null ? '' : delta(d, '%p', {digits: 0})}</dd></div>
  </dl>
  <div class="spark">${spark(g)}<div class="spark-l"><span>${md(D.dates[0])}</span><span>직전 ${pct(g.p.roas)} · 당일 ${man(g.t.s)}</span><span>${md(D.dates[D.dates.length - 1])}</span></div></div>
  <div class="card-original">${hasOriginal(g) ? originalAction(g.ads.find(a=>originFor(a)?.media?.length)||g.ads.find(a=>originFor(a)?.post)||g.ads[0],g.id,'광고 원본 보기') : '<span class="muted">원본 미확보</span>'}</div>
</div>`;
}

function table(list) {
  const rows = list.map(g => {
    const d = dpp(g);
    return `<tr data-id="${g.id}" tabindex="0"><td><div class="t-name">${esc(title(g))}</div><div class="c-code" title="${esc(g.n)}">${esc(g.n)}</div></td>
<td class="col-h">${esc(D.accounts[g.a].name)}</td><td class="n">${man(g.r.s)}</td><td class="n col-h">${int(g.r.c)}</td>
<td class="n">${pct(g.r.roas)}</td><td class="n col-h">${d == null ? '—' : delta(d, '%p', {digits: 0})}</td>
<td class="col-h">${bdg(CAT[g.cat])}</td><td>${bdg(STK[g.stock.st], stockTitle(g))}</td><td class="col-h"><span class="dot${g.on ? ' on' : ''}">${g.on ? '집행 중' : '종료'}</span></td></tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>소재</th><th class="col-h">계정</th><th class="n">광고비 7일</th><th class="n col-h">구매</th><th class="n">ROAS</th><th class="n col-h">직전 대비</th><th class="col-h">효율</th><th>재고</th><th class="col-h">상태</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const L = D.groups.filter(g =>
    matchProduct(g) &&
    (state.on === 'all' || g.on > 0) &&
    (!state.acc || String(g.a) === state.acc) &&
    (!state.cat || g.cat === state.cat) &&
    (!state.stock || g.stock.st === state.stock) &&
    (!state.pa || isPA(g)) &&
    (!q || g.names.concat(g.camp, g.ads, title(g)).join(' ').toLowerCase().includes(q)));
  const k = state.sort, nz = (v, f) => v == null ? f : v;
  L.sort((a, b) => k === 'roas' ? nz(b.r.roas, -1) - nz(a.r.roas, -1) || b.r.s - a.r.s
    : k === 'delta' ? nz(dpp(a), 1e9) - nz(dpp(b), 1e9) || b.r.s - a.r.s
    : k === 'buy' ? b.r.c - a.r.c || b.r.s - a.r.s
    : b.r.s - a.r.s || b.t.s - a.t.s);
  return L;
}

function renderList() {
  const L = filtered();
  const s = L.reduce((t, g) => t + g.r.s, 0), v = L.reduce((t, g) => t + g.r.v, 0), c = L.reduce((t, g) => t + g.r.c, 0);
  $('#result-sum').textContent = `${L.length.toLocaleString()}개 · 광고비 ${man(s)}원 · 구매 ${int(c)} · ROAS ${s ? pct(v / s * 100) : '—'} (최근 7일)`;
  const shown = L.slice(0, limit);
  $('#list').innerHTML = !L.length ? '<div class="empty">조건에 맞는 소재가 없습니다. 필터를 줄여 보세요.</div>'
    : state.view === 'table' ? table(shown) : `<div class="grid">${shown.map(card).join('')}</div>`;
  const more = $('#list-more');
  more.hidden = L.length <= limit;
  more.textContent = `${Math.min(60, L.length - limit)}개 더 보기 · 남은 ${L.length - limit}개`;
}

function syncControls() {
  $('#product-select').value = state.product;
  document.querySelectorAll('[data-product]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.product===state.product)));
  $('#q').value = state.q;
  for (const [id, k] of [['#f-acc', 'acc'], ['#f-cat', 'cat'], ['#f-stock', 'stock'], ['#f-on', 'on'], ['#sort', 'sort']]) $(id).value = state[k];
  $('#f-pa').setAttribute('aria-pressed', state.pa ? 'true' : 'false');
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view ? 'true' : 'false'));
}

const stockWatch = () => D.groups.filter(g => matchProduct(g) && g.on > 0 && (g.stock.st === 'risk' || g.stock.st === 'soldout')).sort((a, b) => b.r.s - a.r.s);
function renderStockWatch() {
  const sw = stockWatch();
  const srow = g => `<button type="button" class="srow" data-id="${g.id}" title="${esc(g.stock.why)}">
<span class="sr-n"><b>${esc(title(g))}</b><span class="c-code">${esc(g.n)}</span></span>
<span class="sr-c">${chipHTML(g, 4) || bdg(STK[g.stock.st])}</span>
<span class="sr-v"><i>총재고</i>${int(totalStock(g))}</span><span class="sr-v"><i>광고비 7일</i>${man(g.r.s)}</span><span class="sr-v"><i>ROAS</i>${pct(g.r.roas)}</span></button>`;
  $('#stock-watch').innerHTML = sw.length ? `<div class="sub-h"><h3>재고 주의 · 지출 상위</h3><p>집행 중 ${sw.length}개 중 최근 7일 광고비 상위 6개. 참고 표시이며 광고 중단 판단이 아닙니다.</p></div>
<div class="rows srows"><div class="srow sh" aria-hidden="true"><span>상품 · 소재</span><span>품절 색상·사이즈</span><span>총재고</span><span>광고비 7일</span><span>ROAS</span></div>${sw.slice(0, 6).map(srow).join('')}</div>` : '';
}

/* v3 상단: 광고 1개 = 카드 1장 */
const TV = {good: ['효율 좋음', 'pos'], ok: ['적당', 'warn'], bad: ['효율 안 좋음', 'neg'], sample:['표본 부족','line']};
const band = r => r == null ? 'none' : r >= 270 ? 'pos' : r >= 200 ? 'warn' : 'neg';
const roasOf = (s, v) => s > 0 ? v / s * 100 : null;
function visibleTop() {
  if (!state.product) return D.top;
  return D.groups.filter(g=>matchProduct(g) && g.on>0 && g.ev==='PURCHASE' && ['OFFSITE_CONVERSIONS','VALUE'].includes(g.goal) && g.r.s>0)
    .sort((a,b)=>b.r.s-a.r.s).slice(0,10).map(g=>{
      const rr=g.dy.slice(-3,-1),s=rr.reduce((n,d)=>n+d[0],0),v=rr.reduce((n,d)=>n+d[1],0),c=rr.reduce((n,d)=>n+d[2],0),r2={s,v,c,roas:roasOf(s,v)};
      const verdict=g.cat==='sample'?'sample':(g.r.roas||0)>=270&&(r2.roas||0)>=270?'good':(g.r.roas||0)<200||(r2.roas||0)<200?'bad':'ok';
      return {g:g.id,ad:g.ads.find(a=>originFor(a)?.media?.length)||g.ads.find(a=>originFor(a)?.post)||g.ads[0],n:g.n,acc:D.accounts[g.a].name,img:g.img,r:g.r,r2,t:g.t,v:verdict,b:null,isGroup:true,ch:g.dy.slice(-4).map((d,i)=>[D.dates[D.dates.length-4+i],d[0],d[1],d[2]])};
    });
}
function stockFacts(x) {
  const g = byId[x.g], ps = g.stock.p.map(p => D.products[p]).filter(Boolean), multi = ps.length > 1;
  const gone = [], miss = [];
  ps.forEach((pr, i) => {
    const pre = multi ? `구성${i + 1} ` : '';
    for (const c of pr.colors) {
      if (c.qty <= 0) { gone.push(pre + c.color); continue; }
      Object.keys(c.sizes).filter(z => c.sizes[z] === 0).sort((a, b) => (+a || 0) - (+b || 0)).forEach(z => miss.push(`${pre}${c.color}-${z}`));
    }
  });
  return {linked: ps.length > 0, total: ps.reduce((t, p) => t + (p.total || 0), 0), gone, miss, names: [...new Set(ps.map(p => p.name))]};
}
const clip = (arr, n) => arr.length <= n ? esc(arr.join(' · ')) : `${esc(arr.slice(0, n).join(' · '))} <span class="more" title="${esc(arr.join('\n'))}">외 ${arr.length - n}개</span>`;
function bars(x) {
  const last = x.ch.length - 1;
  const col = ([d, s, v, c], i) => {
    const r = roasOf(s, v), h = r == null ? 0 : Math.min(r, 600) / 600 * 100, live = i === last;
    return `<div class="bc${live ? ' live' : ''}"><div class="bp"><span class="bl${r >= 1000 ? ' sm' : ''}" style="bottom:${h.toFixed(1)}%"${r > 600 ? ` title="${pct(r)} (600% 초과, 막대는 잘림)"` : ''}>${r == null ? '—' : r >= 10000 ? (r / 10000).toFixed(1) + '만%' : pct(r)}</span>${r == null ? '' : `<i class="bar ${band(r)}${r > 600 ? ' clip' : ''}" style="height:${Math.max(h, 1.5).toFixed(1)}%"></i>`}</div>
<div class="bx"><b>${md(d)}</b>${live ? '<em>진행 중</em>' : ''}<span>${man(s)}</span><span>${int(c)}건</span></div></div>`;
  };
  const lbl = '하루씩 ROAS: ' + x.ch.map(([d, s, v, c], i) => `${md(d)}${i === last ? '(진행 중)' : ''} ${pct(roasOf(s, v))} 쓴 돈 ${man(s)} 구매 ${int(c)}건`).join(', ');
  return `<div class="chart" role="img" aria-label="${esc(lbl)}"><div class="ya" aria-hidden="true"><span style="bottom:100%">600%</span><span style="bottom:66.67%">400%</span><span style="bottom:33.33%">200%</span><span style="bottom:0">0</span></div>
<div class="plot"><i class="ref" aria-hidden="true"></i>${x.ch.map(col).join('')}</div></div>`;
}
function budgetTxt(b) {
  if (!b) return '예산 —';
  if (b.k === 'lifetime') return `총예산 ${man(b.a)} · 어제 ${man(b.y)} 씀 <small>${esc(b.u)}</small>`;
  return `예산 ${man(b.a)} · 어제 ${pct(b.y / b.a * 100)} 씀 <small>${esc(b.u)} 기준</small>`;
}
function tcard(x) {
  const g = byId[x.g], sf = stockFacts(x), c = who(x.n);
  const prod = x.n.replace(/^ASC\S*\.\s*/, '').split('_').find(t => /[가-힣]/.test(t) && !/^전환$/.test(t)) || sf.names[0] || '광고';
  const paProduct = /_PA_[^_]+_([^_]+)$/.exec(x.n)?.[1];
  const name = (paProduct || prod) + (/1\+1/.test(x.n) ? ' 1+1' : '');
  const hookParts = x.n.split('_'), mi = hookParts.indexOf('메타');
  const hook = mi > 0 ? hookParts.slice(1, mi).filter(t => /[가-힣]/.test(t) && !['단품히든','히든','영상','세로','시딩','파트너콘텐츠','수정',c].includes(t)).slice(-1)[0] : '';
  const th = x.img ? `<button type="button" class="tthumb${x.img.lr ? ' lr' : ''}" data-zoom="${x.img.src}" aria-label="${esc(c)} 썸네일 크게 보기"><img src="${x.img.src}" alt="" loading="lazy"></button>`
    : `<div class="tthumb ph">썸네일<br>없음</div>`;
  const stockH = !sf.linked ? '<span class="muted">재고 미연결</span>' : `<span>재고 <b>${int(sf.total)}</b></span>${sf.miss.length || sf.gone.length ? `<span class="warn">옵션 품절 ${sf.miss.length ? sf.miss.length+'개':''}${sf.gone.length ? (sf.miss.length?' · ':'')+'색상 '+sf.gone.length+'개':''}</span>` : '<span>옵션 재고 있음</span>'}`;
  return `<article class="tc ${x.v}" data-ad="${esc(x.ad)}" data-id="${x.g}" role="button" tabindex="0" aria-label="${esc(name)} 상세 설명 보기">
${th}<div class="tc-content"><div class="tn"><h3>${esc(name)}</h3>${bdg(TV[x.v])}</div>
<p class="tp" title="${esc(x.n)}">${esc([c,hook].filter(Boolean).join(' · ') || x.n)}</p>
<div class="tc-numbers"><div><span>7일 ROAS</span><strong class="${band(x.r.roas)}">${pct(x.r.roas)}</strong></div><div><span>7일 쓴 돈</span><b>${man(x.r.s)}</b></div><div><span>구매</span><b>${int(x.r.c)}건</b></div></div>
${bars(x)}<p class="sub">최근 이틀 <b class="${band(x.r2.roas)}">${pct(x.r2.roas)}</b></p>
<div class="tc-stock">${stockH}</div><div class="tc-actions">${originalAction(x.ad,x.g)}<button type="button" class="tmore" data-id="${x.g}">상세 · 재고</button></div></div></article>`;
}
function renderTop() {
  const T = visibleTop(), w = D.windows, by = k => T.filter(x => x.v === k || (k==='ok'&&x.v==='sample'));
  const total = state.product ? D.groups.filter(g=>matchProduct(g)&&g.on>0) : T;
  const sum = (k, f) => total.reduce((t, x) => t + x[k][f], 0);
  const s7 = sum('r', 's'), v7 = sum('r', 'v'), c7 = sum('r', 'c'), issue = T.filter(x => stockFacts(x).miss.length).length;
  const tile = (l, v, sub, cls = '') => `<div class="tile ${cls}"><div class="tl">${l}</div><div class="tv">${v}</div><div class="tsub">${sub}</div></div>`;
  const nb = by('bad').length;
  $('#tiles').innerHTML = tile('오늘 쓴 돈', man(sum('t', 's')), `${state.product?'선택 제품 집행 중 전체':'여기 광고 '+T.length+'개'} 합계 · ${md(w.today)} 진행 중`)
    + tile('7일 ROAS', pct(roasOf(s7, v7)), `${man(s7)} 써서 매출 <b>${man(v7)}</b> · ${int(c7)}건`)
    + tile('효율 안 좋음', nb + '개', `상위 ${T.length}개 광고 중`, nb ? 'neg' : '')
    + tile('재고 확인사항', issue + '개', '없는 사이즈 등', issue ? 'warn' : '');
  const badNames = by('bad').map(x => who(x.n) || x.n.split('_')[0]);
  $('#lead-notes').innerHTML = [
    `${state.product?'선택 제품의 구매 목적 소재 묶음':'광고'} 지출 상위 ${T.length}개 · 완료 7일 ${md(w.recent[0])}–${md(w.recent[1])} · 빗금 막대는 오늘(진행 중) · 끊긴 막대는 600% 초과`,
    '카드를 누르면 상세 설명과 재고가 열립니다. 사진을 누르면 확대됩니다. 200%·270%는 비교 기준이며 손익분기점은 아닙니다.'
  ].map(t => `<li>${t}</li>`).join('');
  const sec = (k, h, p, empty) => {
    const L = by(k), el = $('#t-' + k), sh = el.parentElement.querySelector('.tier-h');
    el.parentElement.hidden = L.length === 0;
    sh.querySelector('h2').textContent = `${h} ${L.length}개`; sh.querySelector('p').textContent = p;
    el.innerHTML = L.length ? L.map(tcard).join('') : `<div class="empty">${empty}</div>`;
  };
  sec('good', '효율 좋은 광고', '7일·최근 이틀 모두 270% 이상', '없음');
  sec('ok', '지켜볼 광고', by('ok').some(x=>x.v==='sample') ? '효율 관찰 · 집행 표본 확인' : '200% 이상 · 최근 흐름 확인', '없음');
  sec('bad', '효율 낮은 광고', '7일 또는 최근 이틀 200% 미만', `상위 ${T.length}개 중 해당 없음 · 전체 목록은 아래에서 확인`);
  $('#all-note').textContent = state.product ? '선택 제품의 전체 소재 묶음입니다. 일반·히든 판매페이지 광고와 이 제품이 포함된 1+1 광고를 함께 봅니다.' : `위 ${T.length}개는 광고 하나씩. 아래는 같은 게시물을 한 묶음으로 본 전체 목록이에요(계정·효율·재고 필터, 검색).`;
  const selected = productViews.find(p=>p.key===state.product);
  $('#product-note').textContent = selected ? `${selected.name} · 합계는 이 제품을 광고한 집행 중 소재 전체입니다. 여러 제품이 함께 나오는 광고는 각 제품 보기에 포함되므로 제품별 합계를 서로 더하면 중복됩니다.` : '제품을 선택하면 해당 제품의 광고와 합산 성과를 볼 수 있습니다. 같은 제품의 일반·히든 판매페이지는 함께 묶습니다.';
}
function lightbox(src) {
  const lb = $('#lb');
  if (!src) { lb.hidden = true; document.body.classList.remove('lock'); return; }
  $('#lb-img').src = src; lb.hidden = false; document.body.classList.add('lock'); $('#lb-x').focus({preventScroll: true});
}

function renderNotes() {
  const w = D.windows;
  const notes = [
    `<b>판정</b>: 좋음 = 7일(${md(w.recent[0])}~${md(w.recent[1])}) ROAS 270% 이상 그리고 최근 이틀(${md(w.recent2[0])}·${md(w.recent2[1])}) 270% 이상 · 안 좋음 = 둘 중 하나라도 200% 미만 · 나머지 적당. 오늘(${md(w.today)})은 진행 중이라 판정에서 뺍니다.`,
    `<b>위 ${D.top.length}개</b> = 온라인 계정 · 지금 켜진(ACTIVE) · 구매 최적화 광고 중 7일 쓴 돈 상위 ${D.top.length}개(광고 하나씩). 예산은 캠페인 예산(CBO)이면 캠페인, 아니면 광고세트 기준이며 "어제 ○% 씀"은 그 단위 전체의 어제 지출 ÷ 지금 하루 예산입니다(어제 중 예산이 바뀌었거나 메타가 하루 예산을 넘겨 쓰면 100%를 넘을 수 있음).`,
    '<b>구매</b>는 Meta 귀속 구매(omni_purchase 우선, 없으면 purchase, 그다음 픽셀 구매). 상품별 실제 판매 수량과 같지 않습니다.',
    '<b>ROAS</b> = 기간 귀속매출 합 ÷ 광고비 합. 일별 ROAS의 평균이 아닙니다.',
    '<b>200% · 270%</b>는 소재 비교 구간이며 손익분기점이 아닙니다. 아래 전체 목록의 표본 부족 = 최근 7일 광고비 3만원 미만 또는 집행일 3일 미만.',
    '<b>재고</b>는 ' + esc(D.stockRule) + ' 카드의 "없는 사이즈"는 재고가 남은 색상 중 판매 옵션 수량이 0인 사이즈, "다 팔린 색"은 색상 전체 0. 1+1 세트는 구성품별로 표시합니다. 참고 표시이며 광고 중단 판단이 아닙니다.',
    `성과는 <b>1시간마다</b>, 자사몰 주문 가능 수량은 <b>15분마다</b> 갱신합니다. 광고 ${esc(fmtTime(D.retrieved))} · 수량 ${esc(fmtTime(D.stockAsOf))} 조회 기준입니다. 메타의 집계 지연은 별도이며 창고 실재고·출고 가능 여부와는 다릅니다.`,
    '<b>전체 목록의 소재 묶음</b>은 같은 게시물(없으면 같은 크리에이티브)을 계정·최적화 목적별로 합친 단위입니다.'
  ];
  $('#notes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
}

function fmtTime(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(d);
  const g = t => p.find(x => x.type === t)?.value;
  return `${g('month')}/${g('day')} ${g('hour')}:${g('minute')} KST`;
}

/* 패널 */
function originalsHTML(g) {
  const seen = new Set(), rows = [];
  for (const aid of g.ads) {
    const o=originFor(aid); if (!o || (!o.post && !o.media?.length)) continue;
    const key=o.post || aid; if(seen.has(key))continue;seen.add(key);
    const media=(o.media||[]).map(m=>m.type==='video'
      ? `<video class="original-video" controls playsinline preload="metadata"${g.img?` poster="${esc(g.img.src)}"`:''}><source src="${esc(m.src)}" type="video/mp4">브라우저가 영상을 지원하지 않습니다.</video><a class="p-link" href="${esc(m.src)}" target="_blank" rel="noopener">광고 영상 새 창에서 보기</a>`
      : `<a href="${esc(m.src)}" target="_blank" rel="noopener"><img class="original-image" src="${esc(m.src)}" alt="광고 등록 이미지 원본" loading="lazy"></a><a class="p-link" href="${esc(m.src)}" target="_blank" rel="noopener">광고 이미지 원본 열기</a>`).join('');
    rows.push(`<div class="original-item" data-original-ad="${aid}">${media||'<p class="p-sub">아래 원본 게시물에서 전체 광고를 볼 수 있습니다.</p>'}${o.post?`<a class="original-post" href="${esc(o.post)}" target="_blank" rel="noopener">Instagram 원본 게시물 열기 ↗</a>`:''}<details class="code"><summary>이 원본의 광고 이름</summary><span>${esc(o.name)}</span></details></div>`);
  }
  return `<div class="p-sec p-originals" id="ad-originals"><h3>광고 원본</h3>${rows.join('')||`<p class="p-sub">${D.originLoadFailed?'원본 목록을 불러오지 못했습니다. 새로고침해 주세요.':'이 광고의 원본 주소는 현재 조회되지 않았습니다.'}</p>`}</div>`;
}
function explainHTML(g) {
  const topAds = visibleTop().filter(x => x.g === g.id);
  const explain = topAds.map(x => {
    const reason = x.v==='sample'?'광고비 3만원 또는 집행 3일 기준을 충족하지 못해 효율 판정을 보류합니다.':x.v === 'good' ? '7일과 최근 이틀의 ROAS가 모두 270% 이상입니다.' : x.v === 'bad' ? '7일 또는 최근 이틀의 ROAS가 200% 미만입니다.' : '두 기간 모두 200% 이상이지만, 한쪽 이상이 270%에 미치지 못합니다.';
    return `<div class="p-memo"><b>${esc(TV[x.v][0])}으로 표시한 이유</b><p>최근 7일 ROAS <b>${pct(x.r.roas)}</b> · 최근 이틀 <b>${pct(x.r2.roas)}</b>. ${reason}</p><p>7일 광고비 ${won(x.r.s)}로 메타 귀속 구매 ${int(x.r.c)}건이 잡혔습니다. 오늘 ${md(D.windows.today)}은 진행 중이므로 위 판정에서 제외했습니다.</p>${x.b ? `<p>${budgetTxt(x.b)}. 여러 광고가 공유하는 예산일 수 있습니다.</p>` : ''}${g.cnt > 1 ? `<p>${x.isGroup?'이 설명과 아래 기간 비교는 같은 소재 광고 '+g.cnt+'개를 합산합니다.':'이 설명은 광고 ID '+esc(x.ad)+' 기준이며, 아래 기간 비교는 같은 소재 광고 '+g.cnt+'개를 합산합니다.'}</p>` : ''}</div>`;
  }).join('');
  let body = explain;
  if (!body) body = `<div class="p-memo"><b>${esc(CAT[g.cat][0])}</b><p>최근 7일 광고비 ${won(g.r.s)}, 구매 ${int(g.r.c)}건, ROAS ${pct(g.r.roas)}입니다.${g.cat === 'sample' ? ' 광고비 3만원 또는 집행 3일 기준을 충족하지 않아 효율 판정을 보류합니다.' : g.cat === 'other' ? ' 구매 목적이 아닌 광고는 구매 ROAS만으로 평가하지 않습니다.' : ' 전체 목록은 최근 7일 ROAS 구간으로 분류합니다.'}</p></div>`;
  if (g.p.roas != null && g.r.roas != null) {
    const diff = g.r.roas - g.p.roas;
    body += `<p class="p-explain-trend">${g.cnt > 1 ? '소재 묶음 기준 ' : ''}직전 7일 ${pct(g.p.roas)} → 최근 7일 ${pct(g.r.roas)}. ROAS가 ${Math.abs(diff).toFixed(1)}%p ${diff >= 0 ? '올랐습니다' : '내렸습니다'}. 광고비는 ${man(g.p.s)} → ${man(g.r.s)}입니다.</p>`;
  }
  return `<div class="p-sec p-explanation"><h3>상세 설명</h3>${body}<p class="p-sub">200%·270%는 비교 기준입니다. 손익 또는 증액·중단을 자동으로 결정하는 기준은 아닙니다.</p></div>`;
}
function panelHTML(g) {
  const acc = D.accounts[g.a].name, n = D.dates.length;
  const per = (l, f) => `<tr><td>${l}</td><td class="n">${f(g.p)}</td><td class="n">${f(g.r)}</td><td class="n">${f(g.t)}</td></tr>`;
  const periods = `<div class="p-box"><table><thead><tr><th></th><th class="n">직전 7일</th><th class="n">최근 7일</th><th class="n">${md(D.windows.today)} 진행 중</th></tr></thead><tbody>
${per('광고비', x => won(x.s))}${per('구매', x => int(x.c))}${per('매출', x => won(x.v))}${per('ROAS', x => pct(x.roas))}${per('구매당 비용', x => won(x.cpa))}</tbody></table></div>`;
  let memo = '';
  if (g.dx) {
    const c = g.dx.chg, lab = {spend: '지출', roas_pp: 'ROAS(%p)', cpm: 'CPM', ctr: 'CTR', cvr: '전환율', aov: '객단가', frequency: '빈도', market_cpm: '계정 전체 CPM'};
    const chips = Object.keys(lab).filter(k => c[k] != null).map(k => `<span>${lab[k]} ${c[k] > 0 ? '+' : ''}${c[k]}${k === 'roas_pp' ? '' : '%'}</span>`).join('');
    const pl = g.dx.pl.length ? `<p>주요 지면: ${g.dx.pl.map(p => `${esc(p.placement)} 비중 ${p.spend_share_rec}% · ROAS ${pct(p.roas_prev)} → ${pct(p.roas_rec)}`).join(' / ')}</p>` : '';
    memo += `<div class="p-sec"><h3>점검 메모 ${bdg(VERDICT[g.dx.v] || [g.dx.v, ''])}</h3><div class="p-memo"><div>${esc(g.dx.txt)}</div><p>선정 기준: ${esc(g.dx.why)}</p>${pl}<div class="chips">${chips}</div></div></div>`;
  }
  if (g.z) memo += `<div class="p-sec"><h3>당일 메모 ${bdg(VERDICT[g.z.v] || [g.z.v, ''])}</h3><div class="p-memo">${esc(g.z.txt)}</div></div>`;

  const daily = g.dy.map((d, i) => `<tr${i === n - 1 ? ' class="tr-today"' : ''}><td>${md(D.dates[i])}${i === n - 1 ? ' 진행 중' : ''}</td><td class="n">${won(d[0])}</td><td class="n">${int(d[2])}</td><td class="n">${won(d[1])}</td><td class="n">${d[0] > 0 ? pct(d[1] / d[0] * 100) : '—'}</td></tr>`).reverse().join('');

  const s = g.stock;
  let stockH = `<div class="p-memo">${bdg(STK[s.st])} <span>${esc(s.why)}</span>${s.gone.length ? `<p>품절 색상: ${s.gone.map(esc).join(', ')}</p>` : ''}</div>`;
  for (const pn of s.p) {
    const pr = D.products[pn]; if (!pr) continue;
    const sizes = [...new Set(pr.colors.flatMap(c => Object.keys(c.sizes)))].sort((a, b) => (+a || 0) - (+b || 0));
    const core = new Set(['225', '230', '235', '240', '245']);
    const rows = pr.colors.map(c => `<tr${c.qty <= 0 ? ' class="gone"' : ''}><td>${esc(c.color)}${c.qty <= 0 ? ' (품절)' : ''}</td><td>${int(c.qty)}</td>${sizes.map(z => {
      const q = c.sizes[z]; return q == null ? '<td>·</td>' : `<td${q === 0 && c.qty > 0 && core.has(z) ? ' class="z"' : ''}>${int(q)}</td>`; }).join('')}</tr>`).join('');
    const lk = pr.url ? `<a class="p-link" href="${esc(pr.url)}" target="_blank" rel="noopener">${esc(pr.name)} ↗</a>${pr.via ? `<span class="p-sub">${esc(pr.via)}로 연결 ·</span> ` : ''}` : `<span class="p-link nolink">${esc(pr.name)}</span>`;
    stockH += `<div class="p-sec" style="margin-top:12px">${lk}<span class="p-sub">총재고 ${int(pr.total)}</span>
<div class="p-box stk"><table><thead><tr><th>색상</th><th>합계</th>${sizes.map(z => `<th${core.has(z) ? ' class="core"' : ''}>${esc(z)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  return `<h2 class="p-title" id="p-title">${esc(title(g))}</h2>
<p class="p-sub p-code">${esc(g.n)}</p>
<p class="p-sub">${esc(acc)} · ${g.on ? `집행 중 광고 ${g.on}개` : '현재 집행 중 아님'} · 묶인 광고 ${g.cnt}개</p>
${originalsHTML(g)}
${explainHTML(g)}
<div class="p-sec"><h3>${g.cnt > 1 ? '소재 묶음 기간 비교' : '기간 비교'}</h3>${periods}</div>
${memo}
<div class="p-sec"><h3>재고 <span>${esc(fmtTime(D.stockAsOf))} 기준 · 참고 표시</span></h3>${stockH}</div>
<div class="p-sec"><h3>일별 <span>최신순</span></h3><div class="p-box"><table><thead><tr><th>날짜</th><th class="n">광고비</th><th class="n">구매</th><th class="n">매출</th><th class="n">ROAS</th></tr></thead><tbody>${daily}</tbody></table></div></div>
<div class="p-sec"><h3>광고 구성</h3><dl class="kv"><dt>캠페인</dt><dd>${g.camp.map(esc).join('<br>') || '—'}</dd><dt>최적화</dt><dd>${esc(g.goal)} · ${esc(g.ev)}</dd><dt>상태</dt><dd>${g.sts.map(esc).join(', ') || '—'}</dd></dl>
<ul class="p-list" style="margin-top:10px">${g.names.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<ul class="p-list"><li><code>광고 ID ${g.ads.map(esc).join(' · ')}</code></li></ul></div>`;
}

function openPanel(id, push = true) {
  const g = byId[id]; if (!g) return;
  lastFocus = document.activeElement;
  $('#p-badges').innerHTML = bdg(CAT[g.cat]) + bdg(STK[g.stock.st]) + (g.dx ? bdg(VERDICT[g.dx.v] || [g.dx.v, '']) : '');
  $('#p-body').innerHTML = panelHTML(g);
  $('#p-body').scrollTop = 0;
  const p = $('#panel'), s = $('#scrim');
  p.hidden = false; s.hidden = false; document.body.classList.add('lock');
  requestAnimationFrame(() => { p.classList.add('show'); s.classList.add('show'); });
  $('#p-close').focus({preventScroll: true});
  if (push) { state.ad = id; writeHash(); }
}
function closePanel() {
  const p = $('#panel'), s = $('#scrim');
  if (p.hidden) return;
  p.querySelectorAll('video').forEach(v=>v.pause());
  p.classList.remove('show'); s.classList.remove('show'); document.body.classList.remove('lock');
  const done = () => { p.hidden = true; s.hidden = true; };
  matchMedia('(prefers-reduced-motion: reduce)').matches ? done() : setTimeout(done, 240);
  state.ad = ''; writeHash();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({preventScroll: true});
}

function bind() {
  const changeProduct = value => { closePanel(); state={...DEF,product:value,view:state.view};limit=60;writeHash();syncControls();renderTop();renderStockWatch();renderList(); };
  $('#product-select').addEventListener('change',e=>changeProduct(e.target.value));
  $('#product-shortcuts').addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b)changeProduct(b.dataset.product)});
  const set = (k, v) => { state[k] = v; limit = 60; writeHash(); renderList(); };
  let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => set('q', e.target.value), 120); });
  for (const [id, k] of [['#f-acc', 'acc'], ['#f-cat', 'cat'], ['#f-stock', 'stock'], ['#f-on', 'on'], ['#sort', 'sort']]) $(id).addEventListener('change', e => set(k, e.target.value));
  $('#f-pa').addEventListener('click', e => { const on = !state.pa; e.currentTarget.setAttribute('aria-pressed', on); set('pa', on ? '1' : ''); });
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { set('view', b.dataset.view); syncControls(); }));
  $('#list-more').addEventListener('click', () => { limit += 60; renderList(); });
  document.addEventListener('click', e => {
    const origin=e.target.closest('[data-original]');
    if(origin){openPanel(origin.dataset.group);$('#ad-originals')?.scrollIntoView({block:'start'});return;}
    const el = e.target.closest('[data-id]'); if (el && !e.target.closest('a,details,video')) openPanel(el.dataset.id);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#lb').hidden) return lightbox(null); return closePanel(); }
    const el = e.target.closest && e.target.closest('[data-id][tabindex]');
    if (el && !e.target.closest('summary,button,a,details') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel(el.dataset.id); }
    if (e.key === 'Tab' && !$('#panel').hidden) {  // 포커스 가두기
      const f = [...$('#panel').querySelectorAll('button,a[href],[tabindex]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('click', e => { const z = e.target.closest('[data-zoom]'); if (z) { e.stopPropagation(); lightbox(z.dataset.zoom); } }, true);
  $('#lb').addEventListener('click', () => lightbox(null));
  $('#p-close').addEventListener('click', closePanel);
  $('#scrim').addEventListener('click', closePanel);
  addEventListener('hashchange', () => { readHash(); syncControls();renderTop();renderStockWatch(); renderList(); state.ad ? openPanel(state.ad, false) : closePanel(); });
}

async function init() {
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#ecece7"/><line x1="0" y1="0" x2="0" y2="3" stroke="#c3c3bc" stroke-width="1.4"/></pattern></defs></svg>');
  try {
    const r = await fetch('data.json', {cache: 'no-cache'});
    if (!r.ok) throw new Error(r.status);
    D = await r.json();
  } catch (e) {
    $('#main').innerHTML = '<div class="empty" style="margin-top:40px">데이터를 불러오지 못했습니다. 새로고침해 주세요.</div>';
    return;
  }
  try { const o=await fetch('originals.json',{cache:'no-cache'});if(!o.ok)throw new Error(o.status);D.originals=(await o.json()).ads; }
  catch(e){D.originals={};D.originLoadFailed=true;}
  D.groups.forEach(g => { byId[g.id] = g; });
  setupProducts();
  updateFreshness();
  const used = new Set(D.groups.map(g => g.a));
  $('#f-acc').innerHTML = '<option value="">전체 계정</option>' + D.accounts.map((a, i) => used.has(i) ? `<option value="${i}">${esc(a.name)}</option>` : '').join('');
  readHash(); syncControls();
  renderTop(); renderStockWatch(); renderNotes(); renderList(); bind();
  if (state.ad) openPanel(state.ad, false);
  setInterval(updateFreshness, 60000);
  setInterval(checkRefresh, 60000);
}
function updateFreshness() {
  const stale = [['성과', D.retrieved, 90], ['자사몰 수량', D.stockAsOf, D.staleAfterMinutes || 40]]
    .filter(([, value, limit]) => !Number.isFinite(Date.parse(value)) || Date.now() - Date.parse(value) > limit * 60000)
    .map(([name]) => name);
  const el = $('#asof');
  el.textContent = `성과 1시간·수량 15분마다 갱신 · 성과 ${fmtTime(D.retrieved).replace(' KST', '')} · 자사몰 수량 ${fmtTime(D.stockAsOf).replace(' KST', '')}`
    + (stale.length ? ` · ${stale.join('·')} 갱신 지연 — 이전 조회값` : '');
  el.style.color = stale.length ? '#b45309' : '';
  el.setAttribute('role', 'status');
}
async function checkRefresh() {
  if (document.hidden) return;
  try {
    const r = await fetch('data.json?t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) return;
    const next = await r.json();
    if (next.retrieved === D.retrieved && next.stockAsOf === D.stockAsOf) return;
    // Do not interrupt a playing original or open detail; recheck next minute.
    if (!$('#panel').hidden || !$('#lb').hidden) return;
    location.reload(); // Product selection and filters are retained in the URL hash.
  } catch (_) { /* Keep the last view and its truthful timestamp. */ }
}
init();
})();
