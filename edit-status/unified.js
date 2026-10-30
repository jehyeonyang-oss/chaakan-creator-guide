(() => {
  'use strict';
  const SOURCE = 'https://kangnaan00.github.io/connecting-3sec-guide/collab-schedule/';
  const SOURCE_YEAR = 2026; // The source is the 2026 FW schedule; it omits the year.
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = x => String(x ?? '').replace(/\s+/g, ' ').trim();
  const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
  const fmt = x => number(x) === null ? '미수집' : x.toLocaleString('ko-KR');
  const safeURL = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['www.instagram.com','instagram.com','www.youtube.com','youtube.com','youtu.be','jehyeonyang-oss.github.io','seeding-a700a.web.app','kangnaan00.github.io'].includes(u.hostname) ? u.href : ''; } catch { return ''; }
  };
  const postKey = value => {
    const url = safeURL(value); if (!url) return '';
    const u = new URL(url), match = u.pathname.match(/^\/(?:reel|p)\/([\w-]+)/);
    if (u.hostname.endsWith('instagram.com')) return match ? 'ig:' + match[1] : '';
    if (u.hostname === 'youtu.be') { const id = u.pathname.slice(1); return /^[\w-]+$/.test(id) ? 'yt:' + id : ''; }
    if (u.hostname.endsWith('youtube.com')) { const id = u.searchParams.get('v') || u.pathname.match(/^\/shorts\/([\w-]+)/)?.[1]; return id && /^[\w-]+$/.test(id) ? 'yt:' + id : ''; }
    return '';
  };
  const date = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
    const d = new Date(value + 'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value ? value : '';
  };
  const fromMD = (value, year = SOURCE_YEAR) => {
    const m = String(value).match(/(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?!\d)/); return m ? date(`${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`) : '';
  };
  const nowDate = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0,10);
  const stamp = value => {
    const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('ko-KR', { timeZone:'Asia/Seoul', month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false }) : '미확인';
  };
  const dayText = d => d ? d.slice(5).replace('-','/') : '일정 미정';
  const link = (url, label) => safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '';
  const teamName = team => team === 'mine' ? '양제현' : '서울링크';
  const teamBadge = team => `<span class="u-team-badge ${team === 'seoul' ? 'seoul' : ''}">${teamName(team)}</span>`;
  const embedded = JSON.parse($('content-data')?.textContent || '{"items":[]}');
  const state = { team:'all', search:'', view:'table', range:'upcoming', mine:[], seoul:[], busy:false, source:{mine:{state:'loading'},seoul:{state:'loading'}} };

  // Never join by creator handle: the same creator can have different work in each team.
  function performance(c) {
    const key = postKey(c.postUrl);
    const item = key ? (embedded.items || []).find(it => postKey(it.url) === key) : null;
    const observed = [c.engagementBaseline, ...(c.engagement || [])].filter(x => x && x.actualCollectedAt);
    observed.sort((a,b) => new Date(b.actualCollectedAt).getTime() - new Date(a.actualCollectedAt).getTime());
    const candidates = [...observed, item?.w?.latest].filter(x => x && Number.isFinite(new Date(x.actualCollectedAt || x.at).getTime()));
    candidates.sort((a,b) => new Date(b.actualCollectedAt || b.at).getTime() - new Date(a.actualCollectedAt || a.at).getTime());
    const source = candidates[0];
    const measured = source ? { views:number(source.views), shares:number(source.shares), saves:number(source.saves ?? source.saved), at:source.actualCollectedAt || source.at } : null;
    // Only an exact post match provides a verified content cost; contract fee text is not a numeric total.
    const cost = number(item?.cost);
    return { measured, cost };
  }

  function normalizeMine(data) {
    if (![1,2].includes(data.schemaVersion) || !Array.isArray(data.creators) || !Number.isFinite(Date.parse(data.syncedAt))) throw Error('양제현 데이터 형식 확인 필요');
    const rows = data.creators.map((c, i) => {
      if (!c.account || !c.name) throw Error('양제현 항목 확인 필요');
      const posted = c.status === '게시완료', status = posted ? '게시완료' : /종료|보류|취소/.test(c.status || '') ? c.status : c.stage || c.status || '상태 미확인';
      const postDate = date(c.postDate), schedule = clean(c.schedule), events = [];
      if (date(c.sentDate)) events.push({ date:c.sentDate, kind:'제품 발송', detail:'발송 기록', certainty:'기록' });
      if (date(c.deliveredDate)) events.push({ date:c.deliveredDate, kind:'제품 수령', detail:'배송 완료 기록', certainty:'기록' });
      if (postDate) events.push({date:postDate, kind:posted ? '게시 완료' : '업로드', detail:schedule, certainty:posted ? '완료' : c.scheduleType || '예정'});
      // Dates embedded in the schedule remain explicitly labeled as planned, never inferred as done.
      const year = Number(postDate?.slice(0,4)) || Number(String(data.syncedAt).slice(0,4)) || SOURCE_YEAR;
      for (const match of schedule.matchAll(/(?:초안\s*)?(\d{1,2}\/\d{1,2})([^·()]*)/g)) {
        const when = fromMD(match[1], year);
        if (!when) continue;
        const before = schedule.slice(Math.max(0, match.index - 4), match.index + 3);
        const ranged = /~|전후|이내|이후|이전/.test(match[2]);
        const kind = /초안/.test(match[0] + before) ? '초안' : /업로드|게시/.test(match[2]) ? '업로드' : '일정';
        if (events.some(e => e.date === when && (e.kind === kind || e.kind === '게시 완료' && kind === '업로드'))) continue;
        events.push({date:when,kind,detail:schedule,certainty:ranged ? '예정 범위 · 원문 확인' : c.scheduleType || '예정'});
      }
      return { key:'mine:' + (new URL(safeURL(c.recordUrl) || 'https://seeding-a700a.web.app').searchParams.get('id') || `${c.account}:${c.track}:${i}`), team:'mine', name:c.name, account:c.account, track:c.track || '미등록', product:clean(c.product), content:clean(c.content), fee:clean(c.fee) || '미확인', status, statusDetail:c.status !== status ? clean(c.status) : '', posted, contact:false, schedule:schedule || '일정 미정', scheduleType:c.scheduleType || '미확인', next:clean(c.next) || '다음 할 일 미등록', events, ...performance(c), postUrl:safeURL(c.postUrl), recordUrl:safeURL(c.recordUrl), guideUrl:safeURL(c.guideUrl), badges:[], referenceUrl:'' };
    });
    if (data.contacts != null && !Array.isArray(data.contacts)) throw Error('컨택 데이터 형식 확인 필요');
    for (const [i,c] of (data.contacts || []).entries()) {
      if (!c.account) throw Error('컨택 계정 확인 필요');
      rows.push({key:`contact:${c.track}:${c.account}:${i}`,team:'mine',name:c.name || c.account,account:c.account,track:c.track || '미등록',product:'',content:'',fee:'미확인',status:'컨택 중',statusDetail:'',posted:false,contact:true,schedule:'일정 미정',scheduleType:'미정',next:'회신·협의 내용 확인',events:[],measured:null,cost:null,postUrl:'',recordUrl:safeURL(c.recordUrl),guideUrl:'',referenceUrl:'',badges:[]});
    }
    return rows;
  }

  function parseSeoul(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('#tab-visit');
    if (!root) throw Error('서울링크 일정표 구조 확인 필요');
    const commonGuide = [...doc.querySelectorAll('a[href]')].map(a => safeURL(a.getAttribute('href'))).find(url => url && new URL(url).hostname === 'kangnaan00.github.io' && new URL(url).pathname.includes('/chakhangudu-guide/')) || '';
    const rows = [], keys = new Set();
    for (const group of root.querySelectorAll('.date-group')) {
      const visitDate = fromMD(clean(group.querySelector('.date-label')?.textContent));
      if (!visitDate) throw Error('서울링크 방문 날짜 확인 필요');
      for (const row of group.querySelectorAll('.row')) {
        const account = clean(row.querySelector('.id')?.textContent).replace(/^@/,'');
        const sub = clean(row.querySelector('.sub')?.textContent), visitTime = clean(row.querySelector('.time')?.textContent);
        if (!/^[A-Za-z0-9._]+$/.test(account) || !/업로드/.test(sub)) throw Error('서울링크 일정 항목 확인 필요');
        const uploadDate = fromMD(sub), fee = sub.match(/([\d,]+(?:\.\d+)?)\s*만/);
        const links = [...row.querySelectorAll('.row-left .link')];
        const referenceUrl = safeURL(links[0]?.querySelector('a')?.getAttribute('href'));
        const postContainer = links.find(el => /업로드/.test(el.textContent));
        const postUrl = safeURL(postContainer?.querySelector('a')?.getAttribute('href'));
        if (postUrl && !postKey(postUrl)) throw Error('서울링크 게시 링크 확인 필요');
        const badges = [...row.querySelectorAll('[class*="badge-"]')].map(el => clean(el.textContent));
        const reshoot = badges.some(x => x.includes('재촬영')), pending = badges.some(x => x.includes('미업로드'));
        const posted = !!postUrl && !pending && !reshoot;
        const status = reshoot ? '재촬영' : pending ? '미업로드' : posted ? '게시완료' : '업로드 대기';
        const key = `seoul:${account}:${visitDate}`;
        if (keys.has(key)) throw Error('서울링크 중복 일정 확인 필요'); keys.add(key);
        const events = [{date:visitDate,kind:'매장 방문',detail:visitTime || '시간 미등록',certainty:'등록 일정'}];
        if (uploadDate) events.push({date:uploadDate,kind:posted ? '게시 완료' : '업로드',detail:sub,certainty:posted ? '완료' : '예정'});
        rows.push({key,team:'seoul',name:account,account,track:'매장 방문',product:'',content:'',fee:fee ? `${fee[1]}만원` : '미확인',status,statusDetail:badges.filter(x=>x !== status).join(' · '),posted,contact:false,schedule:sub,scheduleType:posted ? '완료' : '예정',visitDate,visitTime,uploadDate,next:reshoot ? '재촬영 일정·결과 확인' : posted ? '게시 후 성과 확인' : badges.some(x=>x.includes('모델')) ? '모델 준비 · 업로드 확인' : '업로드·게시 링크 확인',events,...performance({postUrl}),postUrl,recordUrl:SOURCE,guideUrl:commonGuide,referenceUrl,badges});
      }
    }
    // A redesign or empty response must never silently erase the last valid source.
    if (!rows.length || rows.length !== root.querySelectorAll('.row').length) throw Error('서울링크 일정표 항목 확인 필요');
    return rows;
  }

  function filtered() {
    const query = state.search.toLocaleLowerCase();
    return [...state.mine,...state.seoul].filter(r => (state.team === 'all' || r.team === state.team) && (!query || [r.name,r.account,r.track,r.product,r.content,r.status,r.next,r.fee,teamName(r.team)].join(' ').toLocaleLowerCase().includes(query)));
  }
  function metrics(r) {
    if (!r.measured) return `<span class="u-period">${r.posted ? '미수집' : '성과 미수집'}</span>`;
    const m = r.measured, ss = m.shares !== null && m.saves !== null ? m.shares + m.saves : null;
    const unit = ss > 0 && r.cost !== null ? Math.round(r.cost / ss) : null;
    return `<div class="u-perf-line">조회 ${fmt(m.views)}</div><div class="u-perf-line">공유 ${fmt(m.shares)} · 저장 ${fmt(m.saves)}</div>${unit !== null ? `<div class="u-perf-line ${unit > 500 ? 'u-error' : ''}">1건당 ${fmt(unit)}원</div>` : '<small>공유·저장당 비용 미확인</small>'}<small>측정 ${stamp(m.at)}</small>`;
  }
  const statusClass = r => r.posted ? 'done' : /재촬영|모델/.test(r.status + r.statusDetail) ? 'attention' : '';
  function renderTable(rows) {
    $('u-table-body').innerHTML = rows.map(r => `<tr data-team="${r.team}" data-key="${esc(r.key)}"><td>${teamBadge(r.team)}</td><td class="u-person"><b>${esc(r.name)}</b>${link(`https://www.instagram.com/${encodeURIComponent(r.account)}/`, '@' + r.account).replace('<a ', '<a class="u-account" ')}<small>${esc(r.track)}</small>${r.product ? `<small>${esc(r.product)}</small>` : ''}</td><td><span class="u-status ${statusClass(r)}">${esc(r.status)}</span>${r.statusDetail ? `<small>${esc(r.statusDetail)}</small>` : ''}</td><td class="u-brief">${r.visitDate ? `<div>방문 ${dayText(r.visitDate)} · ${esc(r.visitTime || '시간 미등록')}</div>` : ''}<div>${esc(r.schedule)}</div><small>${esc(r.scheduleType)}${r.team === 'seoul' ? ' · 방문 완료 여부는 원본에 없음' : ''}</small></td><td class="u-fee"><b>${esc(r.fee)}</b>${/합산/.test(r.fee) ? '<small>묶음 계약 · 건별 합계 제외</small>' : ''}</td><td>${metrics(r)}</td><td class="u-brief">${esc(r.next)}${r.content ? `<small>${esc(r.content)}</small>` : ''}</td><td class="u-links">${link(r.postUrl,'게시물')}${r.guideUrl ? link(r.guideUrl + (r.team === 'mine' ? (r.guideUrl.includes('?') ? '&' : '?') + 'staff=1' : ''),'촬영 가이드') : ''}${link(r.referenceUrl,'참고 영상·계정')}${link(r.recordUrl,r.team === 'mine' ? '업무 기록' : '원본 일정표')}${r.team === 'mine' && r.recordUrl ? '<small>업무 기록 로그인 필요</small>' : ''}</td></tr>`).join('') || '<tr><td colspan="8"><div class="u-empty">조건에 맞는 업무가 없습니다.</div></td></tr>';
  }
  function renderTimeline(rows) {
    const today = nowDate(), groups = new Map(), undated = [];
    for (const row of rows) {
      if (!row.events.length) { undated.push(row); continue; }
      let shown = 0;
      for (const event of row.events) {
        const overdue = !row.posted && !/종료|취소/.test(row.status) && /업로드|초안|일정/.test(event.kind) && event.date < today;
        if (state.range === 'upcoming' && event.date < today && !overdue) continue;
        if (!groups.has(event.date)) groups.set(event.date, []);
        groups.get(event.date).push({row,event:overdue ? {...event,certainty:'기한 확인 필요 · '+event.certainty} : event});
        shown++;
      }
      if (!row.posted && !/종료|취소/.test(row.status) && !shown) undated.push(row);
    }
    const eventHTML = (r,e) => `<article class="u-event" data-team="${r.team}" data-key="${esc(r.key)}">${teamBadge(r.team)}<span>${esc(e.kind)} · ${esc(e.certainty)}</span><strong>${esc(r.name)} <small>${esc(r.track)}</small></strong><p>${esc(e.detail || r.schedule)}</p><small>현재 ${esc(r.status)} · ${esc(r.next)}</small>${r.postUrl && e.kind === '게시 완료' ? link(r.postUrl,'게시물') : ''}</article>`;
    let html = [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([d,list])=>`<section class="u-day"><h4>${dayText(d)}${d === today ? '<small>오늘</small>' : ''}<small>${list.length}개 일정</small></h4><div class="u-events">${list.map(({row,event})=>eventHTML(row,event)).join('')}</div></section>`).join('');
    if (undated.length) html += `<section class="u-day"><h4>일정 미정<small>${undated.length}건</small></h4><div class="u-events">${undated.map(r=>eventHTML(r,{kind:'일정 확인',certainty:'미정',detail:r.schedule})).join('')}</div></section>`;
    $('u-timeline').innerHTML = html || '<div class="u-empty">이 조건에 해당하는 일정이 없습니다. 전체 기간을 선택해 이전 일정을 볼 수 있습니다.</div>';
  }
  function renderSources() {
    for (const team of ['mine','seoul']) {
      const source = state.source[team], el = $('u-source-' + team);
      el.dataset.state = source.state;
      let text = source.state === 'loading' ? '연결 중' : source.state === 'error' ? (source.checkedAt ? '연결 실패 · 마지막 확인 자료 유지' : '연결 실패 · 원본을 확인해 주세요') : source.state === 'stale' ? '원본 갱신 지연 · 표시 시점 확인' : '원본 연결됨';
      el.innerHTML = `<b>${teamName(team)}</b><span role="status">${text}</span>${team === 'seoul' ? link(SOURCE,'원본') : '<a href="#tab-status">상세 현황 ↗</a>'}<br>${source.checkedAt ? `마지막 확인 ${stamp(source.checkedAt)}` : '마지막 확인 없음'}${source.modified ? `<span> · ${team === 'mine' ? '데이터 갱신' : '원본 페이지 배포'} ${stamp(source.modified)}</span>` : ''}${team === 'seoul' ? '<div>원본 일정표 수정 시 반영 · 날짜는 2026년 기준</div>' : '<div>대시보드에 등록된 진행·컨택 기록</div>'}`;
    }
  }
  function render() {
    const rows = filtered(), contacts = rows.filter(r=>r.contact).length, posted = rows.filter(r=>r.posted).length, ongoing = rows.filter(r=>!r.contact&&!r.posted&&!/종료|보류|취소/.test(r.status)).length, missing = rows.filter(r=>!r.contact&&r.fee==='미확인').length;
    const kpi = (label,value,detail) => `<div class="u-kpi"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
    $('u-kpi').innerHTML = kpi('확인된 업무',`${rows.length}건`,`협업 ${rows.length-contacts}건 · 컨택 ${contacts}건`) + kpi('진행 중',`${ongoing}건`,'컨택·게시완료·종료·보류 제외') + kpi('게시 완료',`${posted}건`,'게시완료 상태 또는 게시 링크 확인') + kpi('단가 확인 필요',`${missing}건`,'컨택 건 제외 · 미확인 비용');
    $('u-count').textContent = `${state.team === 'all' ? '전체' : teamName(state.team)} · ${rows.length}건`;
    $('u-data-note').textContent = `${state.source.mine.state === 'error' || state.source.seoul.state === 'error' ? '일부 원본 연결 실패 · ' : ''}같은 크리에이터라도 담당·제품·게시물이 다르면 별도 업무입니다. 비용은 원문 조건대로 표시하며 묶음 계약은 합산하지 않습니다.`;
    $('u-table-wrap').hidden = state.view !== 'table'; $('u-timeline-wrap').hidden = state.view !== 'timeline';
    renderTable(rows); renderTimeline(rows); renderSources();
  }
  async function fetchTimed(url) {
    const ctrl = new AbortController(), timer = setTimeout(()=>ctrl.abort(),15000);
    try { const r = await fetch(url, {cache:'no-store',signal:ctrl.signal}); if (!r.ok) throw Error('HTTP ' + r.status); const body = await r.text(); return {r,body}; }
    finally { clearTimeout(timer); }
  }
  async function refresh() {
    if (state.busy) return; state.busy = true; $('u-refresh').disabled = true;
    const jobs = [
      async () => { const {body} = await fetchTimed('./data.json?t=' + Date.now()); const data = JSON.parse(body), rows = normalizeMine(data); state.mine = rows; state.source.mine = {state:Date.now() - Date.parse(data.syncedAt) > 12*3600000 ? 'stale' : 'ok',checkedAt:Date.now(),modified:data.syncedAt}; },
      async () => { const {r,body} = await fetchTimed(SOURCE + '?hub=' + Date.now()); const rows = parseSeoul(body); state.seoul = rows; state.source.seoul = {state:'ok',checkedAt:Date.now(),modified:r.headers.get('last-modified')}; }
    ];
    await Promise.all(jobs.map((job,i) => job().catch(() => { state.source[i===0?'mine':'seoul'].state = 'error'; }).finally(render)));
    state.busy = false; $('u-refresh').disabled = false;
  }
  for (const b of $('u-team').querySelectorAll('button')) b.addEventListener('click',()=>{state.team=b.dataset.team; for(const x of $('u-team').querySelectorAll('button')){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));} render();});
  for (const b of $('u-view').querySelectorAll('button')) b.addEventListener('click',()=>{state.view=b.dataset.view; for(const x of $('u-view').querySelectorAll('button')){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));} render();});
  $('u-search').addEventListener('input',e=>{state.search=e.target.value.trim();render();});
  $('u-range').addEventListener('change',e=>{state.range=e.target.value;render();});
  $('u-refresh').addEventListener('click',refresh);
  const timer = setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('pagehide',()=>clearInterval(timer));
  window.UnifiedStatus = {parseSeoul,normalizeMine,getState:()=>state,refresh};
  render(); refresh();
})();
