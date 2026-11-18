// 错词记忆：极简 SM-2 间隔重复
// 记录按英文单词全局保存，跨关卡、跨词表复用
const KEY = 'word-garden-srs-v1';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function write(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* 存储已满或被禁用时静默失败 */
  }
}

function snapshot(word) {
  return {
    en: word.en,
    zh: word.zh || word.en,
    emoji: word.emoji || '📘',
    ipa: word.ipa || '',
    example: word.example || '',
  };
}

function touch(rec, word) {
  const snap = snapshot(word);
  rec.zh = snap.zh;
  rec.emoji = snap.emoji;
  rec.ipa = snap.ipa;
  rec.example = snap.example;
  rec.last = Date.now();
  return rec;
}

/** 答错：10 分钟后到期；游戏内默认立即可复习 */
export function markWrong(word, { delay = 0, lapse = true } = {}) {
  if (!word || !word.en) return null;
  const db = read();
  const rec = db[word.en] || { en: word.en, ease: 2.3, interval: 0, streak: 0, lapses: 0, seen: 0 };
  touch(rec, word);
  rec.interval = 10 * MINUTE;
  rec.ease = Math.max(1.3, (rec.ease || 2.3) - 0.2);
  if (lapse) rec.lapses = (rec.lapses || 0) + 1;
  rec.seen = (rec.seen || 0) + 1;
  rec.due = Date.now() + delay;
  db[word.en] = rec;
  write(db);
  return rec;
}

/** 答对：首次 1 天，之后按熟练度翻倍，最长 60 天 */
export function markCorrect(word) {
  if (!word || !word.en) return null;
  const db = read();
  const rec = db[word.en] || { en: word.en, ease: 2.3, interval: 0, streak: 0, lapses: 0, seen: 0 };
  touch(rec, word);
  if (!rec.interval || rec.interval < DAY) rec.interval = DAY;
  else rec.interval = Math.min(60 * DAY, Math.round(rec.interval * (rec.ease || 2.3)));
  rec.ease = Math.min(2.8, (rec.ease || 2.3) + 0.1);
  rec.streak = (rec.streak || 0) + 1;
  rec.seen = (rec.seen || 0) + 1;
  rec.due = Date.now() + rec.interval;
  db[word.en] = rec;
  write(db);
  return rec;
}

export function dueWords(limit = 50) {
  const now = Date.now();
  return Object.values(read())
    .filter(rec => rec && rec.en && rec.due <= now)
    .sort((a, b) => (a.due - b.due) || (b.lapses || 0) - (a.lapses || 0))
    .slice(0, limit)
    .map(rec => ({ ...rec }));
}

export function dueCount() {
  const now = Date.now();
  return Object.values(read()).filter(rec => rec && rec.en && rec.due <= now).length;
}

export function srsStats() {
  const all = Object.values(read()).filter(rec => rec && rec.en);
  const now = Date.now();
  return {
    total: all.length,
    due: all.filter(rec => rec.due <= now).length,
    learned: all.filter(rec => (rec.streak || 0) >= 2).length,
  };
}

export function srsIntervalLabel(rec) {
  const ms = rec?.interval || 0;
  if (ms >= DAY) {
    const days = Math.round(ms / DAY);
    return days === 1 ? '1 天后' : `${days} 天后`;
  }
  return `${Math.max(1, Math.round(ms / MINUTE))} 分钟后`;
}
