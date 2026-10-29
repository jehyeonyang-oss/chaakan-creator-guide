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
  // 설라노 추천 리스트(10/20·10/22·10/28) 계정 = research/설라노_*
  const SULLANO=new Set(['_youarchive','bye0nduck','dal__soba','dlghdtj','mazoolook','mmona.i','salt.yarchive','skarndthf','snugheaven_','woongyange','yachiichii','daily__inn','4.37es','_axxio_x','curin_arc','eaouoi','i0c0i','m.xeull','memo_closet','ssumokki','thxxim','yurimyue','leeeshisi','ott.erss','ooni_oh','ehe_01001','z00_daa','univloginsnu','kxxyounghxx']);
  const sul = a => SULLANO.has(a) ? ' <span class="tag sullano">설라노</span>' : '';
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
    return `<div class="engagement" style="overflow-x:auto"><b>게시 후 성과 추적</b><table style="font-size:11px;min-width:440px"><thead><tr><th>시점 / 예정(KST)</th><th>조회</th><th>좋아요</th><th>댓글</th><th>공유</th><th>저장</th></tr></thead><tbody>${c.engagement.map(s=>`<tr><td>${esc(s.label)}<br>${Number.isFinite(Date.parse(s.dueAt))?esc(md(Date.parse(s.dueAt),true)):''}</td>${['views','likes','comments','shares','saves'].map(k=>`<td>${num(s[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>${c.engagementBaseline?.actualCollectedAt?`<p style="font-size:11px">참고 실측 (${esc(md(c.engagementBaseline.actualCollectedAt,true))}) · 조회 ${num(c.engagementBaseline.views)} · 좋아요 ${num(c.engagementBaseline.likes)} · 댓글 ${num(c.engagementBaseline.comments)} · 공유 ${num(c.engagementBaseline.shares)} · 저장 ${num(c.engagementBaseline.saves)}</p>`:''}<small>실측 전 값은 미수집 · ${c.phoneTrackingReady?'서치폰 예약 수집 연결됨':'폰 연결 대기'}</small></div>`;
  }
  const sidOf = u => { try { return new URL(u).searchParams.get('id')||''; } catch { return ''; } };
  const ymd = d => d ? esc(d.slice(5).replace('-','/')) : '미등록';
  let busy=false, timer;
  function render(data) {
    if(![1,2].includes(data.schemaVersion) || !Array.isArray(data.creators) || data.creators.length>20 || !Number.isFinite(Date.parse(data.syncedAt))) throw Error('Invalid data');
    const rows=data.creators;
    const table=[], byId=new Map();
    for(const [i,c] of rows.entries()) {
      const guide=safe(c.guideUrl,'jehyeonyang-oss.github.io','/chaakan-creator-guide/');
      const record=safe(c.recordUrl,'seeding-a700a.web.app','/creator-review.html');
      const post=safe(c.postUrl,'www.instagram.com','/reel/') || safe(c.postUrl,'www.instagram.com','/p/') || safe(c.postUrl,'www.youtube.com','/watch');
      const n=i+1;
      table.push(`<tr><td><a href="#creator-${n}">${esc(c.name)} ↗</a>${sul(c.account)}</td><td>${trackTag(c)}</td><td>${esc(c.product)}</td><td>${esc(c.stage)}</td><td>${tag(c.status==='게시완료'?'완료':c.scheduleType)} ${esc(c.schedule)}</td></tr>`);
      byId.set(sidOf(c.recordUrl),{c,guide,record,post});
    }
    el('status-rows').innerHTML=table.join('')||'<tr><td colspan="5">진행 중인 캠페인이 없습니다.</td></tr>';
    // Config columns (stage, schedule, next, detail) stay as built; only live cells are refreshed.
    document.querySelectorAll('#creator-cards tr[data-sid]').forEach(tr=>{
      const x=byId.get(tr.dataset.sid);tr.hidden=!x;if(!x)return;
      const {c,guide,record,post}=x;
      if(tr.classList.contains('creator-detail')){const slot=tr.querySelector('.engagement-slot');if(slot)slot.innerHTML=engagement(c);return;}
      tr.querySelector('.live-status').innerHTML=`<b>${esc(c.status||'—')}</b><small>발송 ${ymd(c.sentDate)} · 게시 ${ymd(c.postDate)}</small>${post?`<a class="record" href="${esc(post)}" target="_blank" rel="noopener">게시물 보기 ↗</a>`:''}`;
      tr.querySelector('.links').innerHTML=`${guide?`<a class="guide" data-guide="${esc(guide)}" href="${esc(staff(guide))}" target="_blank" rel="noopener">촬영 가이드 보기 ↗</a><small class="expiry">${esc(expiryText(c.expires))}</small>`:'<a class="guide expired" aria-disabled="true">가이드 미연결</a><small class="expiry">가이드 링크 미등록</small>'}${record?`<a class="record" href="${esc(record)}" target="_blank" rel="noopener">대시보드 기록 ↗ <span>로그인 필요</span></a>`:''}`;
    });
    el('count-creators').textContent=rows.length+'명';
    el('count-tracks').textContent=TRACKS.map(t=>t+' '+rows.filter(c=>trackOf(c)===t).length).join(' · ');
    const contacts=data.schemaVersion===2&&Array.isArray(data.contacts)?data.contacts.slice(0,30):null;
    el('contact-list').innerHTML=!contacts?'<p class="table-note">데이터 연결 중</p>':!contacts.length?'<p class="table-note">컨택 중 없음</p>':TRACKS.map(t=>{
      const items=contacts.filter(c=>c.track===t);if(!items.length)return '';
      return `<div class="contact-group"><h3>${esc(t)} <small>${items.length}명</small></h3><ul>${items.map(c=>{const record=safe(c.recordUrl,'seeding-a700a.web.app','/creator-review.html');return `<li><a href="${ig(c.account)}" target="_blank" rel="noopener">@${esc(c.account)} ↗</a>${sul(c.account)}<span class="tag track">${esc(t)}</span>${record?`<a class="contact-record" href="${esc(record)}" target="_blank" rel="noopener">기록 ↗ <span>로그인 필요</span></a>`:''}</li>`}).join('')}</ul></div>`;
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
