const overlay = () => document.getElementById('overlay');
const dialog = () => document.getElementById('dialog');

export function showDialog({ html, actions = [], dismissible = false, onDismiss } = {}) {
  const box = dialog();
  box.innerHTML = html;

  const row = document.createElement('div');
  row.className = 'dialog-actions';
  actions.forEach(({ label, cls = '', onClick }) => {
    const btn = document.createElement('button');
    btn.className = `big-btn ${cls}`.trim();
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (onClick) onClick();
    });
    row.appendChild(btn);
  });
  if (actions.length) box.appendChild(row);

  const ov = overlay();
  ov.classList.remove('hidden');
  ov.onclick = (e) => {
    if (e.target !== ov) return;
    if (dismissible) closeDialog();
    if (onDismiss) onDismiss();
  };
}

export function closeDialog() {
  overlay().classList.add('hidden');
  dialog().innerHTML = '';
}

let toastTimer = 0;

export function toast(text, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function starString(stars, max = 3) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, max - stars));
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
