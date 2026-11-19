/* Static defaults + Firestore overrides. Rebuilding the catalog never writes notes. */
window.OpinionNotes=(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults=new Map(), remote=new Map(), drafts=new Map(), timers=new Map(), busy=new Set();
  for(const a of window.RESEARCH.accounts){defaults.set(`account_${a.handle}_opinion`,a.user);defaults.set(`account_${a.handle}_action`,a.userAction);}
  for(const c of window.RESEARCH.cards){defaults.set(`reel_${c.code}_opinion`,c.user);defaults.set(`reel_${c.code}_action`,c.userAction);}
  let auth,db,master=false,ready=false,editing=false,storageOK=true;
  const storageKey='dissect-opinion-drafts-v1';
  const current=k=>remote.get(k)||{text:defaults.get(k)||'',revision:0};
  const value=k=>master&&drafts.has(k)?drafts.get(k).text:current(k).text;
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(Object.fromEntries(drafts)));}catch{storageOK=false;}}
  function banner(text){document.querySelector('#notes-connection').textContent=text;}
  function field(key,label){return `<div class="opinion-field" data-note="${esc(key)}"><label for="note-${esc(key)}">${esc(label)} <span>내 의견</span></label><textarea id="note-${esc(key)}" maxlength="10000" rows="2" readonly placeholder="아직 적은 의견이 없습니다.">${esc(value(key))}</textarea><small class="note-status" role="status"></small><div class="note-conflict" hidden><p></p><button type="button" data-note-cloud>저장된 의견 사용</button><button type="button" data-note-mine>내 초안으로 저장</button></div><button type="button" class="note-retry" data-note-retry hidden>다시 저장</button></div>`;}
  function fit(t){t.style.height='auto';t.style.height=Math.max(62,t.scrollHeight+3)+'px';}
  function paint(){
    for(const el of document.querySelectorAll('[data-note]')){
      const k=el.dataset.note,t=el.querySelector('textarea'),d=master?drafts.get(k):null;
      if(!(document.activeElement===t&&d)&&t.value!==value(k))t.value=value(k);
      t.readOnly=!(master&&editing&&ready);fit(t);
      const status=el.querySelector('.note-status');
      status.textContent=d?(d.status||'입력 중 · 자동 저장 대기'):(remote.has(k)?'저장된 의견':'');
      if(d&&!storageOK)status.textContent+=' · 이 브라우저의 초안 보관도 실패했습니다. 창을 닫기 전에 복사해 주세요.';
      status.classList.toggle('error',!!d?.error);
      el.querySelector('[data-note-retry]').hidden=!(d?.error&&!d?.conflict);
      const conflict=el.querySelector('.note-conflict');conflict.hidden=!d?.conflict;
      if(d?.conflict)conflict.querySelector('p').textContent='다른 곳에서 저장된 의견: '+current(k).text;
    }
  }
  function toolbar(){
    document.querySelector('#notes-login').hidden=!!auth?.currentUser;
    document.querySelector('#notes-logout').hidden=!auth?.currentUser;
    document.querySelector('#notes-edit').hidden=!master;
    document.querySelector('#notes-edit').textContent=editing?'편집 마치기':'내 의견 수정';
    document.querySelector('#notes-help').textContent=master?'수정하면 자동으로 공유 저장됩니다.':auth?.currentUser?'이 계정은 열람만 가능합니다. 의견 수정은 소유자 계정으로 로그인해 주세요.':'시딩 앱 계정으로 로그인하면 의견을 수정할 수 있습니다.';
  }
  async function save(k){
    const d=drafts.get(k);if(!d||busy.has(k)||!master||!ready||d.conflict)return;
    busy.add(k);const text=d.text,base=d.base;d.status='저장 중…';d.error=false;paint();
    try{
      const rev=await db.runTransaction(async tx=>{
        const ref=db.collection('reel_research_notes').doc(k),snap=await tx.get(ref);
        const actual=snap.exists?snap.data().revision:0;
        if(actual!==base){const error=new Error('conflict');error.code='note-conflict';error.remote=snap.exists?snap.data():{text:defaults.get(k)||'',revision:0};throw error;}
        tx.set(ref,{text,revision:actual+1});return actual+1;
      });
      remote.set(k,{text,revision:rev});
      const latest=drafts.get(k);
      if(latest?.text===text)drafts.delete(k);
      else if(latest){latest.base=rev;latest.status='추가 수정 저장 대기';}
    }catch(e){
      const latest=drafts.get(k);if(latest){latest.error=true;
        if(e.code==='note-conflict'){remote.set(k,e.remote);latest.conflict=true;latest.status='다른 기기의 수정과 겹쳤습니다. 아래에서 선택해 주세요.';}
        else latest.status='공유 저장 실패 · 초안은 이 브라우저에 보관합니다. 연결·로그인 확인 후 다시 저장해 주세요.';
      }
    }finally{busy.delete(k);persist();paint();const next=drafts.get(k);if(next&&!next.error&&!next.conflict)setTimeout(()=>save(k),100);}
  }
  function flush(){for(const k of drafts.keys()){clearTimeout(timers.get(k));save(k);}}
  function mount(){paint();}
  function start(){
    const dialog=document.querySelector('#notes-auth');
    document.querySelector('#notes-login').onclick=()=>dialog.showModal();
    document.querySelector('#notes-auth-close').onclick=()=>dialog.close();
    document.querySelector('#notes-edit').onclick=()=>{editing=!editing;if(!editing)flush();toolbar();paint();};
    document.querySelector('#notes-logout').onclick=async()=>{
      if(drafts.size){banner('저장되지 않은 초안이 있습니다. 저장 후 로그아웃해 주세요.');return;}
      if(auth)await auth.signOut();
    };
    document.querySelector('#notes-form').onsubmit=async e=>{
      e.preventDefault();const button=e.target.querySelector('[type=submit]'),error=document.querySelector('#notes-auth-error');error.textContent='';
      if(!auth){error.textContent='로그인 연결을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';return;}
      button.disabled=true;
      try{await auth.signInWithEmailAndPassword(document.querySelector('#notes-email').value.trim(),document.querySelector('#notes-password').value);dialog.close();}
      catch{error.textContent='로그인하지 못했습니다. 기존 시딩 앱의 이메일·비밀번호와 연결 상태를 확인해 주세요.';}
      finally{document.querySelector('#notes-password').value='';button.disabled=false;}
    };
    document.addEventListener('input',e=>{
      const el=e.target.closest('[data-note]');if(!el||e.target.tagName!=='TEXTAREA'||!master||!editing)return;
      const k=el.dataset.note,prior=drafts.get(k);drafts.set(k,{text:e.target.value,base:prior?.base??current(k).revision,conflict:prior?.conflict||false,status:prior?.conflict?'다른 기기의 수정과 겹쳤습니다. 아래에서 선택해 주세요.':'입력 중 · 자동 저장 대기'});
      persist();paint();clearTimeout(timers.get(k));timers.set(k,setTimeout(()=>save(k),700));
    });
    document.addEventListener('click',e=>{
      const el=e.target.closest('[data-note]');if(!el||!master)return;const k=el.dataset.note,d=drafts.get(k);if(!d)return;
      if(e.target.matches('[data-note-cloud]')){drafts.delete(k);persist();paint();}
      if(e.target.matches('[data-note-mine]')){d.base=current(k).revision;d.conflict=false;save(k);}
      if(e.target.matches('[data-note-retry]'))save(k);
    });
    window.addEventListener('beforeunload',e=>{if(master&&drafts.size){e.preventDefault();e.returnValue='';}});
    window.addEventListener('online',()=>{if(master)for(const [k,d]of drafts)if(!d.conflict)save(k);});
    window.addEventListener('resize',paint);
    document.fonts.ready.then(paint);
    if(!window.firebase){banner('공유 저장 연결을 불러오지 못했습니다. 현재는 기존 의견만 표시합니다.');return;}
    try{
      const app=firebase.initializeApp({apiKey:'AIzaSyDFUZ8W-IwPg0Jm06WKNe6knPFGq6B-2bw',authDomain:'seeding-a700a.firebaseapp.com',projectId:'seeding-a700a',appId:'1:557792838378:web:c3c44808278c3626920d93'},'dissect-notes');
      auth=app.auth();db=app.firestore();
      auth.onAuthStateChanged(user=>{
        master=user?.email==='jehyeon.yang@chaakan.co.kr';editing=master;
        if(master){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');for(const [k,d]of Object.entries(saved))if(defaults.has(k)&&typeof d.text==='string'&&Number.isInteger(d.base)&&!drafts.has(k))drafts.set(k,{...d,error:true,status:'저장 전 초안 복원 · 다시 저장을 눌러 주세요.'});}catch{storageOK=false;}}
        toolbar();paint();
      });
      db.collection('reel_research_notes').onSnapshot({includeMetadataChanges:true},snap=>{
        for(const change of snap.docChanges()){
          if(change.doc.metadata.hasPendingWrites)continue;
          const k=change.doc.id;if(!defaults.has(k))continue;
          if(change.type==='removed')remote.delete(k);else remote.set(k,change.doc.data());
        }
        if(!snap.metadata.fromCache){ready=true;banner('의견 실시간 연결됨 · 수정 내용은 페이지에 공유됩니다.');}
        else banner('저장 서버 연결 확인 중…');
        paint();
      },()=>{ready=false;banner('공유 의견을 불러오지 못했습니다. 연결 상태를 확인하고 새로고침해 주세요.');paint();});
    }catch{banner('공유 저장 연결에 실패했습니다. 새로고침해 주세요.');}
  }
  return {field,mount,start};
})();
