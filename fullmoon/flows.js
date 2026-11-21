(()=>{
 const data=window.FULLMOON_FLOWS,root=document.querySelector('#flow-selected'),tabs=document.querySelector('.flow-tabs');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>n==null?'미확인':Number(n).toLocaleString('ko-KR');
 let selected=data[0];
 const dialog=document.createElement('dialog');dialog.className='flow-dialog';document.body.append(dialog);
 // The analysis page embeds this long guide at full document height. Keep the
 // viewer inside the parent's visible viewport rather than the iframe midpoint.
 function placeViewer(){try{if(window.parent===window||!window.frameElement)return;const r=window.frameElement.getBoundingClientRect(),h=Math.max(240,window.parent.innerHeight-Math.max(0,r.top)-32);Object.assign(dialog.style,{top:Math.max(16,-r.top+16)+'px',bottom:'auto',margin:'0 auto',maxHeight:h+'px'});dialog.style.setProperty('--viewer-video-height',Math.round(h*.55)+'px')}catch{}}
 try{if(window.parent!==window){window.parent.addEventListener('scroll',()=>{if(dialog.open)placeViewer()},{passive:true});window.parent.addEventListener('resize',placeViewer)}}catch{}
 function close(){dialog.querySelector('video')?.pause();dialog.close()}
 dialog.addEventListener('close',()=>dialog.querySelector('video')?.pause());
 function draw(f){selected=f;tabs.innerHTML=data.map(x=>`<button type="button" data-flow="${x.id}" aria-pressed="${x.id===f.id}">${esc(x.title)}</button>`).join('');
 root.innerHTML=`<h3>${esc(f.title)}</h3><p class="flow-shoot">${esc(f.shoot)}</p><div class="flow-strip">${f.shots.map((s,k)=>`<article><span class="flow-time">${s.time}</span><button class="flow-picture" data-reference="${k}" aria-label="${esc(s.title)} 원본 구간 재생"><img src="${s.ref.img}" alt="${esc(s.ref.title)}" loading="lazy"><span>구도 예시 ▶</span></button><h4>${esc(s.title)}</h4><p>${esc(s.ref.owner)}<br>${esc(s.ref.clock)} ${s.ref.start}초</p></article>`).join('')}</div><p class="flow-note">위 초수는 새로 만들 영상의 배치 제안. 각 사진 아래 초수는 참고 원본의 위치다. 서로 다른 원본을 합친 제작안이며, 원본 전체의 반응을 이 조합의 성과로 해석하지 않는다.</p>`;
 tabs.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>draw(data.find(x=>x.id===b.dataset.flow)));
 root.querySelectorAll('[data-reference]').forEach(b=>b.onclick=()=>open(+b.dataset.reference));
 }
 function open(k){const r=selected.shots[k].ref,m=r.metrics;dialog.innerHTML=`<button class="flow-close" type="button">닫기</button><h3>${esc(r.title)}</h3><video src="${r.video}" poster="${r.img}" controls playsinline preload="metadata"></video><p>${esc(r.owner)} · ${esc(r.clock)} ${r.start}초부터</p>${m?`<p>원본 공유 ${esc(m.sharesDisplay||num(m.shares))} · 저장 ${esc(m.savesDisplay||num(m.saves))}${m.viewsDisplay?' · 조회 '+esc(m.viewsDisplay):''}<br><small>${esc((m.capturedAt||'').slice(0,10))} 서치폰 기록 · 영상 전체 반응</small></p>`:'<p>동작을 설명하는 기존 풀문 예시. 이 컷의 단독 성과는 미검증.</p>'}<p><a href="${r.link}" target="_blank" rel="noopener">원본·근거 보기 →</a></p>`;dialog.querySelector('.flow-close').onclick=close;placeViewer();dialog.showModal();const v=dialog.querySelector('video');v.onloadedmetadata=()=>{v.currentTime=Math.min(r.start,Math.max(0,v.duration-.1));v.play().catch(()=>{})};v.ontimeupdate=()=>{if(v.currentTime>=Math.min(r.end,v.duration))v.pause()}}
 draw(data[0]);
})();
