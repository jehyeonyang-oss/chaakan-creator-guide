(() => {
  'use strict';
  let items = {}, opener = null, loaded = false;
  const dialog = document.createElement('dialog');
  dialog.id = 'ccfm-media-dialog';
  dialog.setAttribute('aria-labelledby', 'ccfm-media-title');
  const heading = document.createElement('div');
  heading.className = 'dialog-heading';
  const title = document.createElement('h2');
  title.id = 'ccfm-media-title';
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '닫기 ×';
  close.setAttribute('aria-label', '소재 닫기');
  heading.append(title, close);
  const content = document.createElement('div');
  content.className = 'ccfm-media-content';
  const status = document.createElement('p');
  status.className = 'caption'; status.setAttribute('role', 'status');
  dialog.append(heading, content, status);
  document.body.append(dialog);

  function open(item, button) {
    opener = button;
    title.textContent = item.name;
    status.textContent = '대행사 전달 원본 · 광고명과 보관 파일명이 일치하는 소재입니다.';
    const media = document.createElement(item.kind === 'video' ? 'video' : 'img');
    if (item.kind === 'video') {
      media.controls = true; media.playsInline = true; media.preload = 'metadata';
      media.setAttribute('aria-label', item.name);
      media.addEventListener('error', () => { status.textContent = '영상을 불러오지 못했습니다. 닫고 다시 열어주세요.'; });
    } else {
      media.alt = item.name;
      media.addEventListener('error', () => { status.textContent = '이미지를 불러오지 못했습니다.'; });
    }
    media.src = item.src;
    content.replaceChildren(media);
    dialog.showModal();
    if (item.kind === 'video') media.play().catch(() => { status.textContent = '재생 버튼을 눌러 영상을 확인하세요.'; });
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    const video = content.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    content.replaceChildren();
    if (opener?.isConnected) opener.focus();
  });

  function decorate() {
    for (const row of document.querySelectorAll('#ads tr[data-ad-id]')) {
      const cell = row.cells[0], item = items[row.dataset.adId];
      if (!cell || cell.dataset.mediaDecorated) continue;
      if (!item) {
        if (loaded && !cell.querySelector('.ccfm-media-missing')) {
          const missing = document.createElement('small');
          missing.className = 'ccfm-media-missing'; missing.textContent = ' · 원본 연결 확인 중';
          cell.append(missing);
        }
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'ccfm-media-trigger';
      button.textContent = cell.textContent;
      button.setAttribute('aria-haspopup', 'dialog');
      const hint = document.createElement('small');
      hint.textContent = item.kind === 'video' ? '▶ 영상 보기' : '이미지 보기 ↗';
      button.append(hint);
      button.addEventListener('click', () => open(item, button));
      cell.replaceChildren(button);
      cell.dataset.mediaDecorated = 'true';
    }
  }
  function refreshMedia() {
    return fetch('ccfm_media.json?t=' + Date.now(), {cache: 'no-store'})
    .then(response => { if (!response.ok) throw Error(); return response.json(); })
    .then(data => {
      items = Object.fromEntries(Object.entries(data.items || {}).filter(([, item]) =>
        ['video', 'image'].includes(item.kind) && /^ccfm_media\/[a-f0-9]{16}\.(mp4|webp)$/.test(item.src)));
      loaded = true;
      decorate();
    }).catch(() => { /* Performance remains available when media loading fails. */ });
  }
  window.CCFMMedia = {decorate, refresh:refreshMedia};
})();
