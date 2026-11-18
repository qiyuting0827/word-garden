const KEY = 'word-garden-ranges-v1';

function cleanUnit(unit) {
  if (!unit || typeof unit !== 'object') return null;
  if (!unit.id || !Array.isArray(unit.words) || !unit.words.length) return null;
  const words = unit.words
    .filter((w) => w && typeof w.en === 'string' && w.en.trim() && typeof w.zh === 'string')
    .map((w) => ({
      en: w.en,
      zh: w.zh,
      emoji: w.emoji || '🎯',
      ipa: w.ipa || '',
      example: w.example || '',
    }));
  if (!words.length) return null;
  return {
    ...unit,
    book: '自选',
    range: true,
    emoji: unit.emoji || '🎯',
    words,
  };
}

export function loadRanges() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(list)) return [];
    return list.map(cleanUnit).filter(Boolean).slice(-40);
  } catch {
    return [];
  }
}

export function saveRanges(list) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(-40)));
}

export function findRange({ book, from, fromWord = 0, to, toWord = 0 }) {
  return loadRanges().find((r) => r.bookSpec === book
    && r.from === from
    && r.to === to
    && (r.fromWord || 0) === fromWord
    && (r.toWord || 0) === toWord) || null;
}

export function addRange({ book, from, fromWord = 0, to, toWord = 0, name, desc, words }) {
  const list = loadRanges();
  const unit = {
    id: `range-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    book: '自选',
    desc,
    emoji: '🎯',
    range: true,
    bookSpec: book,
    from,
    fromWord,
    to,
    toWord,
    words,
    createdAt: Date.now(),
  };
  list.push(unit);
  saveRanges(list);
  return unit;
}

export function deleteRange(id) {
  saveRanges(loadRanges().filter((r) => r.id !== id));
}
