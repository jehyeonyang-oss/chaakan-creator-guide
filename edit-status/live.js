(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = (value, host, prefix) => {
    try { const u = new URL(value); return u.protocol==='https:' && u.hostname===host && u.pathname.startsWith(prefix) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  };
  const tag = value => `<span class="tag ${['확정','완료'].includes(value)?'confirmed':value==='예상'?'estimated':'pending'}">${esc(value)}</span>`;
  const TRACKS=['키높이','26FW'];
  const trackOf = c => TRACKS.includes(c.track) ? c.track : '키높이'; // v1 data was 키높이 only
  const trackTag = c => `<span class="tag track">${esc(trackOf(c))}</span>`;
  const ig = a => `https://www.instagram.com/${encodeURIComponent(a)}/`;
  // Internal page: guides always open with ?staff=1; the deadline only describes the creator link.
  const staff = url => { const u=new URL(url); u.searchParams.set('staff','1'); return u.href; };
  const md = (t, time) => { const k=new Date(t+9*3600000), p=v=>String(v).padStart(2,'0'); return `${k.getUTCMonth()+1}/${k.getUTCDate()}`+(time?` ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`:''); };
  const expiryText = e => { const t=Date.parse(e); return !e||!Number.isFinite(t)?'열람 기한 미등록':Date.now()<t?`크리에이터 열람 ${md(t,true)}까지`:`크리에이터 열람 종료 (${md(t)})`; };
  // Delivered guides are deleted after expiry; a 404 sends staff to the master guide instead.
  const MASTER='https://jehyeonyang-oss.github.io/chaakan-creator-guide/combo/';
  function checkDeleted() {
    document.querySelectorAll('a.guide[data-guide]').forEach(a => {
      fetch(a.dataset.guide, {method:'HEAD', cache:'no-store'}).then(r => {
        if(r.status!==404 || !a.isConnected) return;
        a.href=MASTER; a.textContent='전달본 삭제됨 · 마스터 가이드 보기 ↗'; a.removeAttribute('data-guide');
        const note=a.nextElementSibling; if(note){note.textContent='전달본 삭제 · 로컬 사본은 research 폴더'; note.removeAttribute('data-expires');}
      }).catch(()=>{}); // network errors leave the button unchanged
    });
  }
  function engagement(c) {
    if(!Array.isArray(c.engagement)||!c.engagement.length)return '';
    const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v.toLocaleString('ko-KR'):'미수집';
    return `<div class="engagement" style="overflow-x:auto"><b>게시 후 성과 추적</b><table style="font-size:11px;min-width:440px"><thead><tr><th>시점 / 예정(KST)</th><th>조회</th><th>좋아요</th><th>댓글</th><th>공유</th><th>저장</th></tr></thead><tbody>${c.engagement.map(s=>`<tr><td>${esc(s.label)}<br>${Number.isFinite(Date.parse(s.dueAt))?esc(md(Date.parse(s.dueAt),true)):''}</td>${['views','likes','comments','shares','saves'].map(k=>`<td>${num(s[k])}</td>`).join('')}</tr>`).join('')}</tbody></table><small>실측 전 값은 미수집 · 폰 자동수집 연결 대기</small></div>`;
  }
  let busy=false, timer;
  function render(data) {
    if(![1,2].includes(data.schemaVersion) || !Array.isArray(data.creators) || data.creators.length>20 || !Number.isFinite(Date.parse(data.syncedAt))) throw Error('Invalid data');
    const rows=data.creators;
    const table=[], cards=[];
    for(const [i,c] of rows.entries()) {
      const guide=safe(c.guideUrl,'jehyeonyang-oss.github.io','/chaakan-creator-guide/');
      const record=safe(c.recordUrl,'seeding-a700a.web.app','/creator-review.html');
      const post=safe(c.postUrl,'www.instagram.com','/reel/') || safe(c.postUrl,'www.instagram.com','/p/');
      const n=i+1;
      table.push(`<tr><td><a href="#creator-${n}">${esc(c.name)} ↗</a></td><td>${trackTag(c)}</td><td>${esc(c.product)}</td><td>${esc(c.stage)}</td><td>${tag(c.scheduleType)} ${esc(c.schedule)}</td></tr>`);
      cards.push(`<article id="creator-${n}" class="creator"><div class="card-top"><span class="number">${String(n).padStart(2,'0')}</span><span>${trackTag(c)} ${tag(c.scheduleType)}</span></div><h3>${esc(c.name)}</h3><a class="account" href="${ig(c.account)}" target="_blank" rel="noopener">@${esc(c.account)} ↗</a><p class="product">${esc(c.product)}</p><p class="concept">${esc(c.content)}</p><div class="status"><b>${esc(c.stage)}</b><p>${esc(c.detail)}</p></div><div class="date"><small>콘텐츠 일정</small><strong>${esc(c.schedule)}</strong></div><div class="next"><small>다음 단계</small><p>${esc(c.next)}</p></div>${engagement(c)}<div class="links">${guide?`<a class="guide" data-guide="${esc(guide)}" href="${esc(staff(guide))}" target="_blank" rel="noopener">촬영 가이드 보기 ↗</a><small class="expiry">${esc(expiryText(c.expires))}</small>`:'<a class="guide expired" aria-disabled="true">가이드 미연결</a><small class="expiry">가이드 링크 미등록</small>'}${post?`<a class="record" href="${esc(post)}" target="_blank" rel="noopener">게시물 보기 ↗</a>`:''}${record?`<a class="record" href="${esc(record)}" target="_blank" rel="noopener">대시보드 계정 기록 ↗ <span>로그인 필요</span></a>`:''}</div></article>`);
    }
    el('status-rows').innerHTML=table.join('')||'<tr><td colspan="5">진행 중인 캠페인이 없습니다.</td></tr>';
    el('creator-cards').innerHTML=cards.join('');
    el('count-creators').textContent=rows.length+'명';
    el('count-tracks').textContent=TRACKS.map(t=>t+' '+rows.filter(c=>trackOf(c)===t).length).join(' · ');
    const contacts=data.schemaVersion===2&&Array.isArray(data.contacts)?data.contacts.slice(0,30):null;
    el('contact-list').innerHTML=!contacts?'<p class="table-note">데이터 연결 중</p>':!contacts.length?'<p class="table-note">컨택 중 없음</p>':TRACKS.map(t=>{
      const items=contacts.filter(c=>c.track===t);if(!items.length)return '';
      return `<div class="contact-group"><h3>${esc(t)} <small>${items.length}명</small></h3><ul>${items.map(c=>{const record=safe(c.recordUrl,'seeding-a700a.web.app','/creator-review.html');return `<li><a href="${ig(c.account)}" target="_blank" rel="noopener">@${esc(c.account)} ↗</a><span class="tag track">${esc(t)}</span>${record?`<a class="contact-record" href="${esc(record)}" target="_blank" rel="noopener">기록 ↗ <span>로그인 필요</span></a>`:''}</li>`}).join('')}</ul></div>`;
    }).join('')||'<p class="table-note">컨택 중 없음</p>';
    el('count-dates').textContent=rows.filter(c=>c.postDate&&!['종료','게시완료'].includes(c.status)).length+'명';
    el('count-guides').textContent=rows.filter(c=>safe(c.guideUrl,'jehyeonyang-oss.github.io','/chaakan-creator-guide/')).length+'건';
    el('sync-time').textContent=new Date(data.syncedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
    const stale=Date.now()-Date.parse(data.syncedAt)>12*3600000;
    el('sync-state').textContent=stale?'갱신 지연 · 표시된 시점의 데이터입니다':'대시보드 자동 반영 · 페이지 1분마다 확인';
    el('sync-state').dataset.state=stale?'stale':'ok';
    checkDeleted();
    window.editStatusSnapshot=data;
  }
  async function refresh() {
    if(busy)return;busy=true;
    try {const response=await fetch('./data.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Fetch failed');render(await response.json());}
    catch {el('sync-state').textContent='최신 데이터 연결 실패 · 표시된 시점의 자료입니다';el('sync-state').dataset.state='error';}
    finally {busy=false;}
  }
  checkDeleted(); // static build buttons, before the first data fetch
  refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('pagehide',()=>clearInterval(timer));
})();
