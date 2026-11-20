(() => {
  const panels=[...document.querySelectorAll('.present-slide')];
  let current=0;
  const visible=()=>!document.querySelector('#presentation').hidden;
  function render(){
    panels.forEach((p,i)=>{p.hidden=i!==current;if(i!==current)p.querySelectorAll('video').forEach(v=>v.pause());});
    document.querySelectorAll('[data-present-step]').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.presentStep)===current)));
    document.querySelector('#present-position').textContent=`${current+1} / ${panels.length}`;
    document.querySelector('#present-prev').disabled=current===0;
    document.querySelector('#present-next').disabled=current===panels.length-1;
  }
  function navigate(index){current=Math.min(panels.length-1,Math.max(0,index));location.hash=`present-${current+1}`;render();window.scrollTo({top:0});}
  document.querySelectorAll('[data-present-step]').forEach(b=>b.addEventListener('click',()=>navigate(Number(b.dataset.presentStep))));
  document.querySelector('#present-prev').addEventListener('click',()=>navigate(current-1));
  document.querySelector('#present-next').addEventListener('click',()=>navigate(current+1));
  const modeButton=document.querySelector('#presentation-mode');
  function mode(on,scroll=true){document.body.classList.toggle('presentation-mode',on);modeButton.setAttribute('aria-pressed',String(on));modeButton.textContent=on?'발표자 메모 보기':'발표 화면 시작';if(scroll)window.scrollTo({top:0});}
  modeButton.addEventListener('click',()=>mode(!document.body.classList.contains('presentation-mode')));
  window.addEventListener('keydown',event=>{
    if(!visible()||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,video,dialog'))return;
    if(event.key==='ArrowRight'){event.preventDefault();navigate(current+1);}
    if(event.key==='ArrowLeft'){event.preventDefault();navigate(current-1);}
    if(event.key==='Escape')mode(false);
  });
  function route(){
    const match=location.hash.match(/^#present-([1-8])$/);
    if(match)current=Number(match[1])-1;
    else if(location.hash==='#presentation')current=0;
    if(!visible()){mode(false,false);document.querySelectorAll('#presentation video').forEach(v=>v.pause());}
    render();
  }
  window.addEventListener('hashchange',route);
  route();
})();
