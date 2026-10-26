(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = (value, host, prefix) => {
    try { const u = new URL(value); return u.protocol==='https:' && u.hostname===host && u.pathname.startsWith(prefix) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  };
  const TRACKS=['???','26FW'];
  const ig = a => `https://www.instagram.com/${encodeURIComponent(a)}/`;
  let busy=false, timer;
  function render(data) {
    if(data.schemaVersion!==2 || !Array.isArray(data.contacts) || !Number.isFinite(Date.parse(data.syncedAt))) throw Error('Invalid data');
    const contacts=data.schemaVersion===2&&Array.isArray(data.contacts)?data.contacts.slice(0,30):null;
    el('contact-list').innerHTML=!contacts?'<p class="table-note">데이터 연결 중</p>':!contacts.length?'<p class="table-note">컨택 중 없음</p>':TRACKS.map(t=>{
      const items=contacts.filter(c=>c.track===t);if(!items.length)return '';
      return `<div class="contact-group"><h3>${esc(t)} <small>${items.length}명</small></h3><ul>${items.map(c=>{const record=safe(c.recordUrl,'seeding-a700a.web.app','/creator-review.html');return `<li><a href="${ig(c.account)}" target="_blank" rel="noopener">@${esc(c.account)} ↗</a><span class="tag track">${esc(t)}</span>${record?`<a class="contact-record" href="${esc(record)}" target="_blank" rel="noopener">기록 ↗ <span>로그인 필요</span></a>`:''}</li>`}).join('')}</ul></div>`;
    }).join('')||'<p class="table-note">컨택 중 없음</p>';
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
