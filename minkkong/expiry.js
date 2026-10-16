(() => {
  const expires = Date.parse('2026-10-23T15:09:23+09:00');
  function expire() {
    if (Date.now() < expires) return;
    document.documentElement.style.visibility = 'hidden';
    function showNotice() {
      document.title = '공유 기간이 끝난 가이드';
      document.querySelectorAll('video').forEach(video => video.pause());
      document.body.innerHTML = '<main style="max-width:560px;margin:20vh auto;padding:32px;font-family:sans-serif;line-height:1.8"><h1 style="font-size:28px">공유 기간이 끝난 가이드입니다.</h1><p>가이드가 필요하시면 담당자에게 문의해 주세요.</p></main>';
      document.documentElement.style.visibility = 'visible';
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showNotice, {once:true});
    else showNotice();
  }
  expire();
  setInterval(expire, 30000);
})();
