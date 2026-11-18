// 皮肤与素材路径：本地默认经典素材，公网固定原创素材
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '']);
const KEY = 'word-garden-skin';
const params = new URLSearchParams(location.search);
const forced = params.get('skin');
const isLocal = location.protocol === 'file:' || LOCAL_HOSTS.has(location.hostname);

// 公网永远使用原创素材，避免把无授权素材部署出去。
// 本地可用 ?skin=classic / ?skin=original 切换，并记住选择。
let chosen = 'original';
if (isLocal) {
  if (forced === 'classic' || forced === 'original') {
    try { localStorage.setItem(KEY, forced); } catch { /* ignore */ }
    chosen = forced;
  } else {
    try { chosen = localStorage.getItem(KEY) || 'classic'; } catch { chosen = 'classic'; }
  }
}

export const skin = chosen === 'classic' ? 'classic' : 'original';
export const classic = skin === 'classic';
export const localOnly = isLocal;

export function asset(classicPath, originalPath) {
  return classic ? classicPath : originalPath;
}

export function applySkin() {
  document.body.classList.toggle('skin-classic', classic);
  document.body.classList.toggle('skin-original', !classic);
}
