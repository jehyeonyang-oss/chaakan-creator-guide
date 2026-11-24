(()=>{
 const data=window.FULLMOON_FLOWS,root=document.querySelector('#flow-selected'),tabs=document.querySelector('.flow-tabs');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>n==null?'미확인':Number(n).toLocaleString('ko-KR');
 let selected=data[0];
 const position=r=>r.video?`${esc(r.clock)} ${r.start}초`:r.img?esc(r.clock):'인스타 원본';
 const who=r=>r.owner?esc(r.owner)+' · ':'';
 const preview=(r,label)=>r.img?`<img src="${esc(r.img)}" alt="${esc(r.title)}"><span>${r.video?label:'크게 보기'}</span>`:'';
 const dialog=document.createElement('dialog');dialog.className='flow-dialog';document.body.append(dialog);
 // The analysis page embeds this long guide at full document height. Keep the
 // viewer inside the parent's visible viewport rather than the iframe midpoint.
 function placeViewer(){try{if(window.parent===window||!window.frameElement)return;const r=window.frameElement.getBoundingClientRect(),h=Math.max(240,window.parent.innerHeight-Math.max(0,r.top)-32);Object.assign(dialog.style,{top:Math.max(16,-r.top+16)+'px',bottom:'auto',margin:'0 auto',maxHeight:h+'px'});dialog.style.setProperty('--viewer-video-height',Math.round(h*.55)+'px')}catch{}}
 try{if(window.parent!==window){window.parent.addEventListener('scroll',()=>{if(dialog.open)placeViewer()},{passive:true});window.parent.addEventListener('resize',placeViewer)}}catch{}
 function close(){dialog.querySelector('video')?.pause();dialog.close()}
 dialog.addEventListener('close',()=>dialog.querySelector('video')?.pause());
 function cards(refs,kind){return `<div class="flow-strip flow-examples">${refs.map((r,k)=>!r.img?'':`<article><span class="flow-time">${esc(r.source)}</span><button class="flow-picture" data-${kind}="${k}" aria-label="${esc(r.title)} 구간 재생">${preview(r,'해당 장면 ▶')}</button><h4>${esc(r.title)}</h4><p>${esc(r.note)}</p></article>`).join('')}</div>`}
 function draw(f){selected=f;tabs.hidden=data.length<2;tabs.innerHTML=data.map(x=>`<button type="button" data-flow="${x.id}" aria-pressed="${x.id===f.id}">${esc(x.title)}</button>`).join('');
 root.innerHTML=`<h3>${esc(f.title)}</h3><p class="flow-shoot">${esc(f.shoot)}</p><div class="flow-strip">${f.shots.map((s,k)=>`<article><span class="flow-time">${s.time}</span><button class="flow-picture" data-reference="${k}" aria-label="${esc(s.title)} 원본 구간 재생">${preview(s.ref,'구도 예시 ▶')}</button><h4>${esc(s.title)}</h4></article>`).join('')}</div>`;
 if(f.examples?.length)root.insertAdjacentHTML('beforeend',`<h3 class="flow-examples-title">민현님 원본 예시 하나 더</h3>${cards(f.examples,'opening')}<p class="flow-note"></p>`);
 tabs.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>draw(data.find(x=>x.id===b.dataset.flow)));
 root.querySelectorAll('[data-reference]').forEach(b=>b.onclick=()=>open(selected.shots[+b.dataset.reference].ref));
 root.querySelectorAll('[data-opening]').forEach(b=>b.onclick=()=>open(selected.examples[+b.dataset.opening]));
 }
 function open(r){dialog.innerHTML=`<button class="flow-close" type="button">닫기</button><h3>${esc(r.title)}</h3>${r.video?`<video src="${r.video}" poster="${r.img}" controls playsinline preload="metadata"></video>`:r.img?`<img src="${esc(r.img)}" alt="${esc(r.title)}" style="display:block;max-width:100%;max-height:var(--viewer-video-height,60vh);margin:auto">`:''}${r.note?`<p>${esc(r.note)}</p>`:''}${r.link?`<p><a href="${esc(r.link)}" target="_blank" rel="noopener">인스타 원본 보기 →</a></p>`:''}`;dialog.querySelector('.flow-close').onclick=close;placeViewer();dialog.showModal();const v=dialog.querySelector('video');if(!v)return;v.onloadedmetadata=()=>{v.currentTime=Math.min(r.start,Math.max(0,v.duration-.1));v.play().catch(()=>{})};v.ontimeupdate=()=>{if(v.currentTime>=Math.min(r.end,v.duration))v.pause()}}
 const followups=window.FULLMOON_FOLLOWUPS||[],followRoot=document.querySelector('#followup-examples');
 if(followRoot){followRoot.innerHTML=cards(followups,'followup');followRoot.querySelectorAll('[data-followup]').forEach(b=>b.onclick=()=>open(followups[+b.dataset.followup]));}
 // Flow tabs render on click; warm every example image up front so switching tabs shows pictures immediately.
 [...data.flatMap(f=>[...f.shots.map(s=>s.ref),...(f.examples||[])]),...followups].forEach(r=>{if(r.img)new Image().src=r.img});
 draw(data[0]);
})();
