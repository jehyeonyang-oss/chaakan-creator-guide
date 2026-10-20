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
  let busy=false, timer;
  function render(data) {
    if(![1,2].includes(data.schemaVersion) || !Array.isArray(data.creators) || data.creators.length>20 || !Number.isFinite(Date.parse(data.syncedAt))) throw Error('Invalid data');
    const rows=data.creators;
    const table=[], cards=[];
    for(const [i,c] of rows.entries()) {
      const guide=safe(c.guideUrl,'jehyeonyang-oss.github.io','/chaakan-creator-guide/');
      const record=safe(c.recordUrl,'seeding-a700a.web.app','/creator-review.html');
      const until=Date.parse(c.expires), available=guide&&Number.isFinite(until)&&Date.now()<until;
      const expiry=Number.isFinite(until)?new Date(until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'';
      const n=i+1;
      table.push(`<tr><td><a href="#creator-${n}">${esc(c.name)} ↗</a></td><td>${trackTag(c)}</td><td>${esc(c.product)}</td><td>${esc(c.stage)}</td><td>${tag(c.scheduleType)} ${esc(c.schedule)}</td></tr>`);
      cards.push(`<article id="creator-${n}" class="creator"><div class="card-top"><span class="number">${String(n).padStart(2,'0')}</span><span>${trackTag(c)} ${tag(c.scheduleType)}</span></div><h3>${esc(c.name)}</h3><a class="account" href="${ig(c.account)}" target="_blank" rel="noopener">@${esc(c.account)} ↗</a><p class="product">${esc(c.product)}</p><p class="concept">${esc(c.content)}</p><div class="status"><b>${esc(c.stage)}</b><p>${esc(c.detail)}</p></div><div class="date"><small>콘텐츠 일정</small><strong>${esc(c.schedule)}</strong></div><div class="next"><small>다음 단계</small><p>${esc(c.next)}</p></div><div class="links"><a class="guide${available?'':' expired'}" ${available?`href="${esc(guide)}"`:'aria-disabled="true"'} target="_blank" rel="noopener">${available?'촬영 가이드 보기 ↗':'가이드 재공유 필요'}</a><small class="expiry">${available?'열람 '+esc(expiry)+'까지':'열람 기한 종료 또는 새 링크 확인 필요'}</small>${record?`<a class="record" href="${esc(record)}" target="_blank" rel="noopener">대시보드 계정 기록 ↗ <span>로그인 필요</span></a>`:''}</div></article>`);
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
    el('count-guides').textContent=rows.filter(c=>safe(c.guideUrl,'jehyeonyang-oss.github.io','/chaakan-creator-guide/')&&Date.now()<Date.parse(c.expires)).length+'건';
    el('sync-time').textContent=new Date(data.syncedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
    const stale=Date.now()-Date.parse(data.syncedAt)>12*3600000;
    el('sync-state').textContent=stale?'갱신 지연 · 표시된 시점의 데이터입니다':'대시보드 자동 반영 · 페이지 1분마다 확인';
    el('sync-state').dataset.state=stale?'stale':'ok';
    window.editStatusSnapshot=data;
  }
  async function refresh() {
    if(busy)return;busy=true;
    try {const response=await fetch('./data.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Fetch failed');render(await response.json());}
    catch {el('sync-state').textContent='최신 데이터 연결 실패 · 표시된 시점의 자료입니다';el('sync-state').dataset.state='error';}
    finally {busy=false;}
  }
  refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('pagehide',()=>clearInterval(timer));
})();
