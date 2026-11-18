// 皮肤与素材路径：默认经典素材，可用 ?skin=original 切换为原创皮肤
const KEY = 'word-garden-skin';
const params = new URLSearchParams(location.search);
const forced = params.get('skin');

let chosen = 'classic';
if (forced === 'classic' || forced === 'original') {
  chosen = forced;
  try { localStorage.setItem(KEY, forced); } catch { /* ignore */ }
} else {
  try { chosen = localStorage.getItem(KEY) || 'classic'; } catch { chosen = 'classic'; }
}

export const skin = chosen === 'classic' ? 'classic' : 'original';
export const classic = skin === 'classic';

export function asset(classicPath, originalPath) {
  return classic ? classicPath : originalPath;
}

export function applySkin() {
  document.body.classList.toggle('skin-classic', classic);
  document.body.classList.toggle('skin-original', !classic);
}
