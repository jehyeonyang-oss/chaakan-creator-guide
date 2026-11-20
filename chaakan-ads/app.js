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

let D, byId = {}, state = {}, limit = 60, checksOpen = false, lastFocus = null;
const DEF = {q: '', acc: '', cat: '', stock: '', on: '', sort: 'spend', pa: '', view: 'card', ad: ''};

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

function thumb(g) {
  if (!g.img) return `<div class="thumb"><div class="ph">썸네일<br>미수집</div></div>`;
  const alt = '소재 썸네일';
  if (g.img.lr) return `<div class="thumb lr"><img class="bg" src="${g.img.src}" alt="" loading="lazy" aria-hidden="true"><img class="fg" src="${g.img.src}" alt="${alt}" loading="lazy"></div>`;
  return `<div class="thumb"><img src="${g.img.src}" alt="${alt}" loading="lazy"></div>`;
}

function card(g) {
  const d = dpp(g), acc = D.accounts[g.a].name;
  return `<div class="card" role="button" tabindex="0" data-id="${g.id}" aria-label="${esc(g.n)} 상세 보기">
  <div class="card-main">${thumb(g)}
    <div class="card-info">
      <div class="badges">${bdg(CAT[g.cat])}${bdg(STK[g.stock.st], stockTitle(g))}</div>
      <h3 class="c-name" title="${esc(g.n)}">${esc(g.n)}</h3>
      <div class="c-sub"><span>${esc(acc)}</span><span class="dot${g.on ? ' on' : ''}">${g.on ? `집행 중 ${g.on}` : '집행 종료'}</span></div>
    </div>
  </div>
  <dl class="mets">
    <div><dt>광고비 7일</dt><dd>${man(g.r.s)}</dd></div>
    <div><dt>구매</dt><dd>${int(g.r.c)}</dd></div>
    <div><dt>ROAS</dt><dd>${pct(g.r.roas)}${d == null ? '' : delta(d, '%p', {digits: 0})}</dd></div>
  </dl>
  <div class="spark">${spark(g)}<div class="spark-l"><span>${md(D.dates[0])}</span><span>직전 ${pct(g.p.roas)} · 당일 ${man(g.t.s)}</span><span>${md(D.dates[D.dates.length - 1])}</span></div></div>
</div>`;
}

function table(list) {
  const rows = list.map(g => {
    const d = dpp(g);
    return `<tr data-id="${g.id}" tabindex="0"><td><div class="t-name" title="${esc(g.n)}">${esc(g.n)}</div></td>
<td class="col-h">${esc(D.accounts[g.a].name)}</td><td class="n">${man(g.r.s)}</td><td class="n col-h">${int(g.r.c)}</td>
<td class="n">${pct(g.r.roas)}</td><td class="n col-h">${d == null ? '—' : delta(d, '%p', {digits: 0})}</td>
<td class="col-h">${bdg(CAT[g.cat])}</td><td>${bdg(STK[g.stock.st], stockTitle(g))}</td><td class="col-h"><span class="dot${g.on ? ' on' : ''}">${g.on ? '집행 중' : '종료'}</span></td></tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>소재</th><th class="col-h">계정</th><th class="n">광고비 7일</th><th class="n col-h">구매</th><th class="n">ROAS</th><th class="n col-h">직전 대비</th><th class="col-h">효율</th><th>재고</th><th class="col-h">상태</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const L = D.groups.filter(g =>
    (state.on === 'all' || g.on > 0) &&
    (!state.acc || String(g.a) === state.acc) &&
    (!state.cat || g.cat === state.cat) &&
    (!state.stock || g.stock.st === state.stock) &&
    (!state.pa || isPA(g)) &&
    (!q || g.names.concat(g.camp, g.ads).join(' ').toLowerCase().includes(q)));
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
  $('#q').value = state.q;
  for (const [id, k] of [['#f-acc', 'acc'], ['#f-cat', 'cat'], ['#f-stock', 'stock'], ['#f-on', 'on'], ['#sort', 'sort']]) $(id).value = state[k];
  $('#f-pa').setAttribute('aria-pressed', state.pa ? 'true' : 'false');
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view ? 'true' : 'false'));
}

function renderKPI() {
  const r = D.online.recent, p = D.online.previous, t = D.online.today;
  const tile = (label, val, unit, dl, prev, today) => `<div class="kpi"><div class="kpi-l">${label}</div>
<div class="kpi-v num">${val}<small>${unit}</small></div><div class="kpi-d">${dl}<span>직전 ${prev}</span><span>11/20 진행 중 ${today}</span></div></div>`;
  $('#kpis').innerHTML =
    tile('광고비', man(r.s).replace('만', ''), '만원', delta(rel(r.s, p.s), '%', {neutral: true}), man(p.s), man(t.s)) +
    tile('구매', int(r.c), '건', delta(rel(r.c, p.c), '%'), int(p.c), int(t.c)) +
    tile('매출', man(r.v).replace('만', ''), '만원', delta(rel(r.v, p.v), '%'), man(p.v), man(t.v)) +
    tile('ROAS', Math.round(r.roas), '%', delta(r.roas - p.roas, '%p'), pct(p.roas), pct(t.roas));
  $('#kpi-note').textContent = '온라인 3개 계정 합계(오프라인 계정 제외) · 광고비 증감은 좋고 나쁨 판단 없이 회색으로 표시';
}

function renderChecks() {
  const dx = D.groups.filter(g => g.dx);
  const lead = dx.filter(g => /7cmD/.test(g.n));
  const rest = dx.filter(g => !lead.includes(g));
  const ord = lead.concat(rest.filter(g => g.dx.v !== 'small_sample').sort((a, b) => b.r.s - a.r.s),
    rest.filter(g => g.dx.v === 'small_sample').sort((a, b) => b.r.s - a.r.s));
  const ch = (x, k, l) => x[k] == null ? '' : `<span>${l} <b>${x[k] > 0 ? '+' : ''}${x[k]}%</b></span>`;
  const items = ord.map((g, i) => `<div class="ck${i === 0 && lead.length ? ' lead' : ''}" role="button" tabindex="0" data-id="${g.id}">
  <div class="ck-top">${bdg(VERDICT[g.dx.v] || [g.dx.v, ''])}${g.stock.st === 'risk' || g.stock.st === 'soldout' ? bdg(STK[g.stock.st], g.stock.why) : ''}</div>
  <h3 class="ck-name" title="${esc(g.n)}">${esc(g.n)}</h3>
  <p class="ck-txt">${esc(g.dx.txt)}</p>
  <div class="ck-m"><span>광고비 <b>${man(g.r.s)}</b></span><span>ROAS <b>${pct(g.p.roas)} → ${pct(g.r.roas)}</b></span>${ch(g.dx.chg, 'spend', '지출')}${ch(g.dx.chg, 'cvr', '전환율')}${ch(g.dx.chg, 'ctr', 'CTR')}</div>
</div>`);
  const n0 = lead.length ? 5 : 6;
  $('#checks').innerHTML = items.slice(0, checksOpen ? items.length : n0).join('');
  const b = $('#checks-more');
  b.hidden = items.length <= n0;
  b.textContent = checksOpen ? '접기' : `점검 소재 ${items.length}개 모두 보기`;
  b.setAttribute('aria-expanded', checksOpen ? 'true' : 'false');

  const sw = D.groups.filter(g => g.on > 0 && (g.stock.st === 'risk' || g.stock.st === 'soldout')).sort((a, b) => b.r.s - a.r.s);
  const row = (g, why, right) => `<button type="button" class="row" data-id="${g.id}">${bdg(STK[g.stock.st])}<span class="row-n">${esc(g.n)}</span><span class="row-w">${esc(why)}</span><span class="row-s">${right}</span></button>`;
  $('#stock-watch').innerHTML = sw.length ? `<div class="sub-h"><h3>재고 주의 · 지출 상위</h3><p>집행 중 ${sw.length}개 중 최근 7일 광고비 상위 6개. 참고 표시이며 광고 중단 판단이 아닙니다.</p></div>
<div class="rows">${sw.slice(0, 6).map(g => row(g, g.stock.why, `${man(g.r.s)}<span>ROAS ${pct(g.r.roas)}</span>`)).join('')}</div>` : '';
  const z = D.groups.filter(g => g.z).sort((a, b) => b.z.s - a.z.s);
  $('#today-zero').innerHTML = z.length ? `<div class="sub-h"><h3>11/20 당일 구매 0</h3><p>진행 중 집계라 판단 보류. 다음 날 마감치로 다시 확인.</p></div>
<div class="rows">${z.map(g => `<button type="button" class="row" data-id="${g.id}">${bdg(VERDICT[g.z.v] || [g.z.v, ''])}<span class="row-n">${esc(g.n)}</span><span class="row-w">${esc(g.z.txt)}</span><span class="row-s">${man(g.z.s)}<span>당일 광고비</span></span></button>`).join('')}</div>` : '';
}

function renderNotes() {
  const notes = [
    '<b>구매</b>는 Meta 귀속 구매(omni_purchase 우선, 없으면 purchase, 그다음 픽셀 구매). 상품별 실제 판매 수량과 같지 않습니다.',
    '<b>ROAS</b> = 기간 귀속매출 합 ÷ 광고비 합. 일별 ROAS의 평균이 아닙니다.',
    '<b>200% · 270%</b>는 소재 비교 구간일 뿐 손익분기점이 아닙니다. 표본 부족 = 최근 7일 광고비 3만원 미만 또는 집행일 3일 미만.',
    '<b>재고</b>는 ' + esc(D.stockRule) + ' 참고 표시이며 광고 중단 판단이 아닙니다.',
    `<b>스냅샷</b>입니다. 광고는 ${esc(fmtTime(D.retrieved))}, 재고는 ${esc(fmtTime(D.stockAsOf))} 조회 값이며 자동 갱신되지 않습니다. 11/20은 진행 중 하루치입니다.`,
    '<b>소재 묶음</b>은 같은 게시물(없으면 같은 크리에이티브)을 계정·최적화 목적별로 합친 단위입니다. 온라인 합계는 온라인 3개 계정 기준이며 오프라인 계정은 제외했습니다.'
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
function panelHTML(g) {
  const acc = D.accounts[g.a].name, n = D.dates.length;
  const per = (l, f) => `<tr><td>${l}</td><td class="n">${f(g.p)}</td><td class="n">${f(g.r)}</td><td class="n">${f(g.t)}</td></tr>`;
  const periods = `<div class="p-box"><table><thead><tr><th></th><th class="n">직전 7일</th><th class="n">최근 7일</th><th class="n">11/20 진행 중</th></tr></thead><tbody>
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
    stockH += `<div class="p-sec" style="margin-top:12px"><a class="p-link" href="${esc(pr.url)}" target="_blank" rel="noopener">${esc(pr.name)} ↗</a><span class="p-sub">총재고 ${int(pr.total)}</span>
<div class="p-box stk"><table><thead><tr><th>색상</th><th>합계</th>${sizes.map(z => `<th${core.has(z) ? ' class="core"' : ''}>${esc(z)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  return `<h2 class="p-title" id="p-title">${esc(g.n)}</h2>
<p class="p-sub">${esc(acc)} · ${g.on ? `집행 중 광고 ${g.on}개` : '현재 집행 중 아님'} · 묶인 광고 ${g.cnt}개</p>
<div class="p-sec"><h3>기간 비교</h3>${periods}</div>
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
  p.classList.remove('show'); s.classList.remove('show'); document.body.classList.remove('lock');
  const done = () => { p.hidden = true; s.hidden = true; };
  matchMedia('(prefers-reduced-motion: reduce)').matches ? done() : setTimeout(done, 240);
  state.ad = ''; writeHash();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({preventScroll: true});
}

function bind() {
  const set = (k, v) => { state[k] = v; limit = 60; writeHash(); renderList(); };
  let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => set('q', e.target.value), 120); });
  for (const [id, k] of [['#f-acc', 'acc'], ['#f-cat', 'cat'], ['#f-stock', 'stock'], ['#f-on', 'on'], ['#sort', 'sort']]) $(id).addEventListener('change', e => set(k, e.target.value));
  $('#f-pa').addEventListener('click', e => { const on = !state.pa; e.currentTarget.setAttribute('aria-pressed', on); set('pa', on ? '1' : ''); });
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { set('view', b.dataset.view); syncControls(); }));
  $('#list-more').addEventListener('click', () => { limit += 60; renderList(); });
  $('#checks-more').addEventListener('click', () => { checksOpen = !checksOpen; renderChecks(); });
  document.addEventListener('click', e => { const el = e.target.closest('[data-id]'); if (el && !e.target.closest('a')) openPanel(el.dataset.id); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') return closePanel();
    const el = e.target.closest && e.target.closest('[data-id][tabindex]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel(el.dataset.id); }
    if (e.key === 'Tab' && !$('#panel').hidden) {  // 포커스 가두기
      const f = [...$('#panel').querySelectorAll('button,a[href],[tabindex]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('#p-close').addEventListener('click', closePanel);
  $('#scrim').addEventListener('click', closePanel);
  addEventListener('hashchange', () => { readHash(); syncControls(); renderList(); state.ad ? openPanel(state.ad, false) : closePanel(); });
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
  D.groups.forEach(g => { byId[g.id] = g; });
  const w = D.windows;
  $('#period').textContent = `최근 7일 ${md(w.recent[0])}–${md(w.recent[1]).split('/')[1]} vs 직전 7일 ${md(w.previous[0])}–${md(w.previous[1]).split('/')[1]}`;
  $('#asof').textContent = `광고 ${fmtTime(D.retrieved)} · 재고 ${fmtTime(D.stockAsOf)}`;
  const used = new Set(D.groups.map(g => g.a));
  $('#f-acc').innerHTML = '<option value="">전체 계정</option>' + D.accounts.map((a, i) => used.has(i) ? `<option value="${i}">${esc(a.name)}</option>` : '').join('');
  readHash(); syncControls();
  renderKPI(); renderChecks(); renderNotes(); renderList(); bind();
  if (state.ad) openPanel(state.ad, false);
}
init();
})();
