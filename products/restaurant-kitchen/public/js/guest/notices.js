export function showGuestNotice({ title, message, tone = 'success' }) {
  let overlay = document.getElementById('guest-notice-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'guest-notice-overlay';
    overlay.className = 'guest-notice-overlay';
    overlay.innerHTML = `
      <div class="guest-notice-modal" role="dialog" aria-modal="true" aria-labelledby="guest-notice-title">
        <div class="guest-notice-icon"><i class="fa-solid fa-check"></i></div>
        <h3 id="guest-notice-title"></h3>
        <p id="guest-notice-message"></p>
        <button class="btn btn-primary" id="guest-notice-close">Tamam</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) hideGuestNotice();
    });
    overlay.querySelector('#guest-notice-close').onclick = hideGuestNotice;
  }

  const icon = overlay.querySelector('.guest-notice-icon i');
  const modal = overlay.querySelector('.guest-notice-modal');
  modal.dataset.tone = tone;
  icon.className = tone === 'error' ? 'fa-solid fa-triangle-exclamation' : tone === 'warning' ? 'fa-solid fa-circle-info' : 'fa-solid fa-check';
  overlay.querySelector('#guest-notice-title').textContent = title;
  overlay.querySelector('#guest-notice-message').textContent = message;
  overlay.classList.add('active');
}

export function showGuestConfirmation({ title, message }) {
  return new Promise(resolve => {
    let overlay = document.getElementById('guest-confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'guest-confirm-overlay';
      overlay.className = 'guest-notice-overlay';
      overlay.innerHTML = `
        <div class="guest-notice-modal" role="dialog" aria-modal="true" aria-labelledby="guest-confirm-title">
          <div class="guest-notice-icon"><i class="fa-solid fa-paper-plane"></i></div>
          <h3 id="guest-confirm-title"></h3>
          <p id="guest-confirm-message"></p>
          <div class="guest-notice-actions">
            <button class="btn btn-secondary" id="guest-confirm-cancel">Vazgeç</button>
            <button class="btn btn-primary" id="guest-confirm-send">Talebi Gönder</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('#guest-confirm-title').textContent = title;
    overlay.querySelector('#guest-confirm-message').textContent = message;
    const finish = value => {
      overlay.classList.remove('active');
      resolve(value);
    };
    overlay.querySelector('#guest-confirm-cancel').onclick = () => finish(false);
    overlay.querySelector('#guest-confirm-send').onclick = () => finish(true);
    overlay.onclick = event => {
      if (event.target === overlay) finish(false);
    };
    overlay.classList.add('active');
  });
}

function hideGuestNotice() {
  const overlay = document.getElementById('guest-notice-overlay');
  if (overlay) overlay.classList.remove('active');
}
