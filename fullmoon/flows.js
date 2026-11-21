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
 function cards(refs,kind){return `<div class="flow-strip flow-examples">${refs.map((r,k)=>`<article><span class="flow-time">${esc(r.source)}</span><button class="flow-picture" data-${kind}="${k}" aria-label="${esc(r.title)} 구간 재생"><img src="${esc(r.img)}" alt="${esc(r.title)}" loading="lazy"><span>해당 장면 ▶</span></button><h4>${esc(r.title)}</h4><p>${esc(r.note)}</p><p>${esc(r.owner)} · ${esc(r.clock)} ${r.start}초<br>공유 ${esc(r.metrics?.sharesDisplay||num(r.metrics?.shares))} · 저장 ${esc(r.metrics?.savesDisplay||num(r.metrics?.saves))}</p></article>`).join('')}</div>`}
 function draw(f){selected=f;tabs.innerHTML=data.map(x=>`<button type="button" data-flow="${x.id}" aria-pressed="${x.id===f.id}">${esc(x.title)}</button>`).join('');
 root.innerHTML=`<h3>${esc(f.title)}</h3><p class="flow-shoot">${esc(f.shoot)}</p><div class="flow-strip">${f.shots.map((s,k)=>`<article><span class="flow-time">${s.time}</span><button class="flow-picture" data-reference="${k}" aria-label="${esc(s.title)} 원본 구간 재생"><img src="${s.ref.img}" alt="${esc(s.ref.title)}" loading="lazy"><span>구도 예시 ▶</span></button><h4>${esc(s.title)}</h4><p>${esc(s.ref.owner)}<br>${esc(s.ref.clock)} ${s.ref.start}초</p></article>`).join('')}</div><p class="flow-note">사진 위 시간은 우리 영상에 넣을 순서와 길이의 예시다. 사진 아래 시간은 참고 영상에서 그 장면이 나오는 위치다.</p>`;
 if(f.examples?.length)root.insertAdjacentHTML('beforeend',`<h3 class="flow-examples-title">같은 시작 구도의 다른 예시</h3>${cards(f.examples,'opening')}<p class="flow-note">폰으로 얼굴을 가려도 머리부터 신발까지 담았으면 전신이다. 얼굴을 화면 밖으로 빼고 다리·신발을 크게 담으면 하반신이다.</p>`);
 tabs.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>draw(data.find(x=>x.id===b.dataset.flow)));
 root.querySelectorAll('[data-reference]').forEach(b=>b.onclick=()=>open(selected.shots[+b.dataset.reference].ref));
 root.querySelectorAll('[data-opening]').forEach(b=>b.onclick=()=>open(selected.examples[+b.dataset.opening]));
 }
 function open(r){const m=r.metrics;dialog.innerHTML=`<button class="flow-close" type="button">닫기</button><h3>${esc(r.title)}</h3><video src="${r.video}" poster="${r.img}" controls playsinline preload="metadata"></video><p>${esc(r.owner)} · ${esc(r.clock)} ${r.start}초부터</p>${r.note?`<p>${esc(r.note)}</p>`:''}${m?`<p>원본 공유 ${esc(m.sharesDisplay||num(m.shares))} · 저장 ${esc(m.savesDisplay||num(m.saves))}${m.viewsDisplay?' · 조회 '+esc(m.viewsDisplay):''}<br><small>${esc((m.capturedAt||'').slice(0,10))} 서치폰 확인 · 공유·저장은 이 영상 전체의 수치</small></p>`:'<p>굽을 집고 단면을 보여주는 방법을 참고한다.</p>'}${r.proof?`<details><summary>서치폰 수치 확인 화면</summary><img src="${esc(r.proof)}" alt="공유·저장 확인 화면" style="max-width:100%;height:auto"></details>`:''}<p><a href="${r.link}" target="_blank" rel="noopener">원본·근거 보기 →</a></p>`;dialog.querySelector('.flow-close').onclick=close;placeViewer();dialog.showModal();const v=dialog.querySelector('video');v.onloadedmetadata=()=>{v.currentTime=Math.min(r.start,Math.max(0,v.duration-.1));v.play().catch(()=>{})};v.ontimeupdate=()=>{if(v.currentTime>=Math.min(r.end,v.duration))v.pause()}}
 const followups=window.FULLMOON_FOLLOWUPS||[],followRoot=document.querySelector('#followup-examples');
 if(followRoot){followRoot.innerHTML=cards(followups,'followup');followRoot.querySelectorAll('[data-followup]').forEach(b=>b.onclick=()=>open(followups[+b.dataset.followup]));}
 draw(data[0]);
})();
