// 自定义词表导入：CSV / TSV / 每行「英文 中文」
const KEY = 'word-garden-custom-units-v1';
const MAX_WORDS = 300;

function readRaw() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function validUnit(unit) {
  return unit && typeof unit.id === 'string' && typeof unit.name === 'string'
    && Array.isArray(unit.words) && unit.words.length > 0;
}

export function loadCustomUnits() {
  return readRaw().filter(validUnit);
}

export function saveCustomUnits(units) {
  try {
    localStorage.setItem(KEY, JSON.stringify(units.filter(validUnit)));
    return true;
  } catch {
    return false;
  }
}

export function allUnits(builtin) {
  return [...builtin, ...loadCustomUnits()];
}

export function deleteUnit(id) {
  const next = loadCustomUnits().filter(u => u.id !== id);
  saveCustomUnits(next);
  return next;
}

function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function detectDelimiter(line) {
  if (line.includes('\t')) return '\t';
  if (line.includes(',')) return ',';
  if (line.includes('，')) return '，';
  if (line.includes(';')) return ';';
  return null;
}

function isHeader(cells) {
  const first = (cells[0] || '').toLowerCase();
  const second = (cells[1] || '').toLowerCase();
  return ['en', 'word', 'english', '单词', '英文'].includes(first)
    && (second === '' || ['zh', 'cn', 'meaning', '中文', '释义'].includes(second));
}

/**
 * 解析文本为单词数组。
 * 支持：en,zh,emoji,ipa,example / en<TAB>zh / en zh
 */
export function parseWords(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const words = [];
  const seen = new Set();
  const errors = [];
  let skipped = 0;

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    const delim = detectDelimiter(line);
    let cells;
    if (delim) {
      cells = splitLine(line, delim);
    } else {
      const parts = line.split(/\s+/);
      cells = [parts[0] || '', parts.slice(1).join(' ')];
    }
    if (isHeader(cells)) return;

    const en = String(cells[0] || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const zh = String(cells[1] || '').trim();
    if (!/^[a-z0-9][a-z0-9 '\-.]{0,29}$/.test(en)) {
      skipped++;
      if (errors.length < 6) errors.push(`第 ${index + 1} 行：英文需为 2–30 个字母，可含空格、' - .`);
      return;
    }
    if (!zh) {
      skipped++;
      if (errors.length < 6) errors.push(`第 ${index + 1} 行：缺少中文释义`);
      return;
    }
    if (seen.has(en)) return;
    seen.add(en);

    words.push({
      en,
      zh,
      emoji: String(cells[2] || '').trim() || '📘',
      ipa: String(cells[3] || '').trim(),
      example: String(cells[4] || '').trim(),
    });
  });

  return { words: words.slice(0, MAX_WORDS), skipped, errors, overflow: Math.max(0, words.length - MAX_WORDS) };
}

export function importUnit(name, text) {
  const parsed = parseWords(text);
  if (!parsed.words.length) {
    throw new Error('没有解析到有效单词，请检查格式');
  }
  const cleanName = String(name || '').trim().slice(0, 24) || '我的词表';
  const unit = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: cleanName,
    emoji: '📚',
    desc: parsed.words.slice(0, 3).map(w => w.en).join(' · '),
    custom: true,
    createdAt: Date.now(),
    words: parsed.words,
  };
  const units = loadCustomUnits();
  const total = units.reduce((n, u) => n + u.words.length, 0);
  if (total + parsed.words.length > 3000) {
    throw new Error('自定义词表总量已达上限（3000 词），请先删除旧词表');
  }
  units.push(unit);
  if (!saveCustomUnits(units)) throw new Error('浏览器存储空间不足，导入失败');
  return { unit, ...parsed };
}

export const SAMPLE_CSV = `en,zh,emoji,ipa,example
apple,苹果,🍎,/ˈæpl/,I eat an apple every day.
rainbow,彩虹,🌈,/ˈreɪnbəʊ/,A rainbow is in the sky.
library,图书馆,📚,/ˈlaɪbrəri/,We read books in the library.
`;
