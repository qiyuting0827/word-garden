import { UNITS, DIFFICULTIES } from './words.js';
import { TEXTBOOK_BOOKS, TEXTBOOK_UNITS } from './textbook.js';
import { SAVE_KEY, ART } from './config.js';
import { Game } from './game.js';
import { audio } from './audio.js';
import { applySkin } from './skin.js';
import { showDialog, closeDialog, starString, escapeHtml, toast } from './ui.js';
import { allUnits, importUnit, deleteUnit, SAMPLE_CSV } from './wordstore.js';
import { dueCount, dueWords } from './srs.js';
import { ReviewSession } from './review.js';

const $ = (id) => document.getElementById(id);
const isTouch = window.matchMedia('(pointer: coarse)').matches
  || navigator.maxTouchPoints > 0
  || new URLSearchParams(location.search).has('touch');
if (isTouch) document.body.classList.add('touch');
const BOOK_ORDER = ['主题', ...TEXTBOOK_BOOKS.map(b => b.name), '自定义'];
let activeBook = localStorage.getItem('word-garden-book') || '六上';
let units = [];

function loadUnits() {
  const base = allUnits(UNITS);
  const theme = base.filter(u => !u.custom).map(u => ({ ...u, book: u.book || '主题' }));
  const custom = base.filter(u => u.custom).map(u => ({ ...u, book: '自定义' }));
  return [...theme, ...TEXTBOOK_UNITS, ...custom];
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

function starsOf(unitId, diff) {
  return (loadProgress()[`${unitId}-${diff}`] || {}).stars || 0;
}

function unlocked(unitId, diff) {
  if (diff === 1) return true;
  return starsOf(unitId, diff - 1) >= 1;
}

function fitStage() {
  const stage = $('stage');
  const vv = window.visualViewport;
  const width = vv ? vv.width : window.innerWidth;
  const height = vv ? vv.height : window.innerHeight;
  const scale = Math.min(width / 1760, height / 760);
  stage.style.transform = `scale(${scale})`;
}

/* ================= 触屏屏幕键盘 ================= */
let touchKeysWanted = false;

function makeTkKey(label, key, cls = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `tk-key ${cls}`.trim();
  btn.dataset.k = key;
  btn.textContent = label;
  return btn;
}

function buildTouchKeys() {
  const box = $('tk-rows');
  if (!box || box.childElementCount) return;
  const rows = ['qwertyuiop', 'asdfghjkl'];
  rows.forEach((letters) => {
    const row = document.createElement('div');
    row.className = 'tk-row';
    for (const ch of letters) row.appendChild(makeTkKey(ch, ch));
    box.appendChild(row);
  });

  const row3 = document.createElement('div');
  row3.className = 'tk-row';
  for (const ch of 'zxcvbnm') row3.appendChild(makeTkKey(ch, ch));
  row3.appendChild(makeTkKey('⌫', 'Backspace', 'wide'));
  box.appendChild(row3);

  const row4 = document.createElement('div');
  row4.className = 'tk-row';
  for (const ch of '1234567890') row4.appendChild(makeTkKey(ch, ch, 'digit'));
  box.appendChild(row4);
}

function syncTouchKeys(force = false) {
  if (!isTouch) return;
  const keys = $('touch-keys');
  if (!keys) return;
  if (force) touchKeysWanted = true;
  const visible = game.running
    && !game.paused
    && !$('game').classList.contains('hidden')
    && $('overlay').classList.contains('hidden')
    && game.spelling.mode === 'type';
  keys.classList.toggle('show', visible && touchKeysWanted);
}

function refreshReviewButton() {
  const n = dueCount();
  const badge = $('review-count');
  const btn = $('btn-review');
  if (!badge || !btn) return;
  badge.textContent = String(n);
  badge.classList.toggle('zero', n === 0);
  btn.classList.toggle('has-due', n > 0);
}

function buildBookTabs() {
  const tabs = $('book-tabs');
  if (!tabs) return;
  if (!units.some(u => u.book === activeBook)) {
    activeBook = '主题';
    localStorage.setItem('word-garden-book', activeBook);
  }
  tabs.innerHTML = '';
  BOOK_ORDER.forEach((name) => {
    const count = units.filter(u => u.book === name).length;
    if (!count) return;
    const btn = document.createElement('button');
    btn.className = 'book-tab' + (name === activeBook ? ' active' : '');
    btn.innerHTML = `${escapeHtml(name)}<small>${count}</small>`;
    btn.addEventListener('click', () => {
      if (name === activeBook) return;
      activeBook = name;
      localStorage.setItem('word-garden-book', name);
      audio.play('click', { volume: 0.35 });
      buildMenu();
    });
    tabs.appendChild(btn);
  });
}

function buildMenu() {
  units = loadUnits();
  buildBookTabs();
  const list = $('unit-list');
  list.innerHTML = '';
  const mode = localStorage.getItem('word-garden-mode') || 'type';
  document.querySelectorAll('#menu-mode button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  refreshReviewButton();

  const shown = units.filter(u => u.book === activeBook);
  shown.forEach((unit) => {
    const card = document.createElement('div');
    card.className = 'unit';

    const diffs = DIFFICULTIES.map((d) => {
      const stars = starsOf(unit.id, d.id);
      const locked = !unlocked(unit.id, d.id);
      return `
        <button class="diff ${locked ? 'locked' : ''}" data-unit="${unit.id}" data-d="${d.id}"
                ${locked ? 'disabled' : ''} title="${locked ? '先通过上一难度' : `开始${d.name}`}">
          <span>${d.name}</span>
          <span class="stars">${locked ? '🔒' : starString(stars)}</span>
        </button>`;
    }).join('');

    card.innerHTML = `
      <div class="unit-head">
        <span class="unit-emoji">${unit.emoji}</span>
        <div>
          <div class="unit-name">${escapeHtml(unit.name)}</div>
          <div class="unit-sub">${escapeHtml(unit.desc)} · ${unit.words.length} 词</div>
        </div>
      </div>
      <div class="diffs">${diffs}</div>
      ${unit.custom ? `<button class="unit-del" data-del="${unit.id}" title="删除这个词表">🗑</button>` : ''}
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.diff:not(.locked)').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.play('click');
      startGame(btn.dataset.unit, Number(btn.dataset.d));
    });
  });

  list.querySelectorAll('.unit-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(btn.dataset.del);
    });
  });
}

function confirmDelete(unitId) {
  const unit = units.find(u => u.id === unitId);
  if (!unit) return;
  showDialog({
    html: `<h2>删除词表？</h2>
      <p class="dialog-sub">「${escapeHtml(unit.name)}」的 ${unit.words.length} 个单词将被删除，复习记录会保留。</p>`,
    actions: [
      { label: '取消', cls: 'gray', onClick: closeDialog },
      {
        label: '删除',
        cls: 'red',
        onClick: () => {
          deleteUnit(unitId);
          const progress = loadProgress();
          Object.keys(progress).forEach((key) => {
            if (key.startsWith(`${unitId}-`)) delete progress[key];
          });
          saveProgress(progress);
          closeDialog();
          buildMenu();
          toast('词表已删除');
        },
      },
    ],
  });
}

function startGame(unitId, diff) {
  const unit = units.find(u => u.id === unitId);
  if (!unit) return;
  if (unit.book && unit.book !== activeBook) {
    activeBook = unit.book;
    localStorage.setItem('word-garden-book', activeBook);
  }
  $('menu').classList.add('hidden');
  $('overlay').classList.add('hidden');
  game.start({ unit, diff });
  if (isTouch) {
    buildTouchKeys();
    touchKeysWanted = game.spelling.mode === 'type';
    syncTouchKeys();
  }
}

function nextLevel(unitId, diff) {
  if (diff < 3 && unlocked(unitId, diff + 1)) return { unitId, diff: diff + 1 };
  const index = units.findIndex(u => u.id === unitId);
  const nextUnit = units[(index + 1) % units.length] || units[0];
  return { unitId: nextUnit.id, diff: 1 };
}

function backToMenu() {
  closeDialog();
  $('game').classList.add('hidden');
  $('menu').classList.remove('hidden');
  touchKeysWanted = false;
  syncTouchKeys();
  buildMenu();
}

function openReview(words, { title, onDone } = {}) {
  const session = new ReviewSession(words, { title, onDone });
  session.start();
  return session;
}

function showNextActions(result) {
  const next = nextLevel(result.unit.id, result.diff);
  showDialog({
    html: `<h2>复习完成 🌱</h2>
      <p class="dialog-sub">答对的单词已排到下一次复习，答错的 10 分钟后再来</p>`,
    actions: [
      {
        label: result.win ? '下一关' : '再试一次',
        cls: 'gold',
        onClick: () => {
          closeDialog();
          startGame(result.win ? next.unitId : result.unit.id, result.win ? next.diff : result.diff);
        },
      },
      {
        label: '重玩本关',
        cls: 'gray',
        onClick: () => {
          closeDialog();
          startGame(result.unit.id, result.diff);
        },
      },
      { label: '返回菜单', cls: 'gray', onClick: backToMenu },
    ],
  });
}

function handleFinish(result) {
  const progress = loadProgress();
  if (result.win) {
    const key = `${result.unit.id}-${result.diff}`;
    const prev = progress[key]?.stars || 0;
    progress[key] = { stars: Math.max(prev, result.stars), best: 1 };
    saveProgress(progress);
  }

  const stars = result.win ? result.stars : 0;
  const wrongWords = result.wrongWords.map(({ word }) => word);
  const wrongHtml = result.wrongWords.length
    ? `<div class="wrong-list">
         <div class="title">错词本（点单词可听发音，可进入复习）</div>
         ${result.wrongWords.map(({ word, count }) => `
           <span class="wrong-chip" data-word="${escapeHtml(word.en)}">
             ${escapeHtml(word.en)} <i>${escapeHtml(word.zh)} ×${count}</i>
           </span>`).join('')}
       </div>`
    : `<div class="wrong-list"><div class="title">太棒了，没有错词！</div></div>`;
  const autoTip = wrongWords.length
    ? `<div class="auto-review-tip" id="auto-review-tip">⏱ <b id="auto-left">6</b> 秒后自动开始错词复习 · <button id="auto-cancel" class="link-btn">暂不复习</button></div>`
    : '';

  const next = nextLevel(result.unit.id, result.diff);
  const nextAction = {
    label: result.win ? '下一关' : '再试一次',
    cls: 'gold',
    onClick: () => {
      closeDialog();
      startGame(result.win ? next.unitId : result.unit.id, result.win ? next.diff : result.diff);
    },
  };

  const startReview = () => {
    closeDialog();
    openReview(wrongWords, {
      title: '本关错词复习',
      onDone: () => showNextActions(result),
    });
  };

  const actions = wrongWords.length
    ? [
        {
          label: `📚 复习错词 (${wrongWords.length})`,
          cls: 'gold',
          onClick: startReview,
        },
        {
          label: '重玩本关',
          cls: 'gray',
          onClick: () => {
            closeDialog();
            startGame(result.unit.id, result.diff);
          },
        },
        { label: '返回菜单', cls: 'gray', onClick: backToMenu },
      ]
    : [
        nextAction,
        {
          label: '重玩本关',
          cls: 'gray',
          onClick: () => {
            closeDialog();
            startGame(result.unit.id, result.diff);
          },
        },
        { label: '返回菜单', cls: 'gray', onClick: backToMenu },
      ];

  showDialog({
    html: `
      <h2>${result.win ? '草坪守住了！' : '僵尸进屋了…'}</h2>
      <p class="dialog-sub">${result.win ? '单词就是最好的武器' : '再背一遍单词，下次一定行'}</p>
      <div class="stars-big">${starString(stars)}</div>
      <div class="stats">
        <div class="stat"><b>${Math.round(result.accuracy * 100)}%</b><span>拼写正确率</span></div>
        <div class="stat"><b>${result.correct}</b><span>拼对单词</span></div>
        <div class="stat"><b>${result.maxCombo}</b><span>最高连击</span></div>
        <div class="stat"><b>${result.killed}/${result.total}</b><span>消灭僵尸</span></div>
      </div>
      ${wrongHtml}
      ${autoTip}`,
    actions,
  });

  document.querySelectorAll('.wrong-chip[data-word]').forEach((chip) => {
    chip.addEventListener('click', () => {
      import('./speech.js').then(({ speak }) => speak(chip.dataset.word));
    });
  });

  if (wrongWords.length) {
    let autoTimer = 0;
    let left = 6;
    const stopAuto = () => {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = 0;
      }
    };
    document.querySelectorAll('#dialog .big-btn').forEach((btn) => {
      btn.addEventListener('click', stopAuto, true);
    });
    document.getElementById('auto-cancel')?.addEventListener('click', () => {
      stopAuto();
      const tip = document.getElementById('auto-review-tip');
      if (tip) tip.innerHTML = '已取消自动复习，可点击「📚 复习错词」随时开始';
    });
    autoTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        stopAuto();
        startReview();
      } else {
        const num = document.getElementById('auto-left');
        if (num) num.textContent = String(left);
      }
    }, 1000);
  }
}

function openImport() {
  showDialog({
    html: `
      <h2>导入词表</h2>
      <p class="dialog-sub">一个文件 = 一个单元，导入后按关卡练习</p>
      <div class="import-box">
        <label class="import-label" for="import-name">词表名称</label>
        <input id="import-name" class="import-name" maxlength="24" placeholder="例如：五年级上册 Unit 3" />
        <label class="import-label" for="import-text">单词内容</label>
        <textarea id="import-text" class="import-text" spellcheck="false"
          placeholder="en,zh,emoji,ipa,example&#10;apple,苹果,🍎,/ˈæpl/,I eat an apple every day.&#10;rainbow,彩虹,🌈,,&#10;&#10;也支持每行：apple 苹果"></textarea>
        <div class="file-row">
          <label class="file-btn">📄 选择 CSV / TXT<input id="import-file" type="file" accept=".csv,.txt,text/csv,text/plain" /></label>
          <button id="import-sample-load" class="mini-btn">载入示例</button>
          <button id="import-sample-dl" class="mini-btn">下载 CSV 模板</button>
        </div>
        <div class="import-hint">
          支持逗号 / 制表符 / 中文逗号 / 空格分隔；<code>en,zh</code> 两列即可，
          可加 <code>emoji,ipa,example</code>。英文可含空格、撇号、连字符，单次最多 300 词。
        </div>
        <div id="import-msg" class="import-msg"></div>
      </div>`,
    actions: [
      { label: '取消', cls: 'gray', onClick: closeDialog },
      { label: '导入词表', cls: 'gold', onClick: doImport },
    ],
    dismissible: true,
  });

  $('import-sample-load').addEventListener('click', () => {
    $('import-text').value = SAMPLE_CSV;
    if (!$('import-name').value.trim()) $('import-name').value = '示例词表';
    $('import-text').focus();
  });

  $('import-sample-dl').addEventListener('click', () => {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word-garden-template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $('import-text').value = String(reader.result || '');
      if (!$('import-name').value.trim()) {
        $('import-name').value = file.name.replace(/\.(csv|txt)$/i, '').slice(0, 24);
      }
      $('import-msg').textContent = `已读取 ${file.name}`;
      $('import-msg').classList.remove('bad');
    };
    reader.onerror = () => {
      $('import-msg').textContent = '文件读取失败，请重试';
      $('import-msg').classList.add('bad');
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function doImport() {
  const name = $('import-name').value;
  const text = $('import-text').value;
  const msg = $('import-msg');
  try {
    const result = importUnit(name, text);
    closeDialog();
    activeBook = '自定义';
    localStorage.setItem('word-garden-book', activeBook);
    buildMenu();
    audio.play('win', { volume: 0.3 });
    const extra = result.skipped ? `，跳过 ${result.skipped} 行` : '';
    toast(`已导入「${result.unit.name}」${result.words.length} 词${extra}`, 2400);
    const list = $('unit-list');
    if (list) list.scrollTop = list.scrollHeight;
  } catch (err) {
    msg.textContent = err.message || '导入失败，请检查格式';
    msg.classList.add('bad');
    audio.play('chomp', { volume: 0.25 });
  }
}

const game = new Game({
  onFinish: handleFinish,
  onExit: backToMenu,
});

// 单词风暴按钮
game.spelling.onStorm = () => game.useStorm();
window.__game = game;

document.querySelectorAll('#menu-mode button').forEach((btn) => {
  btn.addEventListener('click', () => {
    localStorage.setItem('word-garden-mode', btn.dataset.mode);
    game.spelling.setMode(btn.dataset.mode);
    document.querySelectorAll('#menu-mode button').forEach(b => b.classList.toggle('active', b === btn));
    if (isTouch) {
      touchKeysWanted = btn.dataset.mode === 'type';
      syncTouchKeys();
    }
    audio.play('click', { volume: 0.4 });
  });
});

$('btn-import').addEventListener('click', () => {
  audio.play('click', { volume: 0.4 });
  openImport();
});

$('btn-review').addEventListener('click', () => {
  audio.play('click', { volume: 0.4 });
  const words = dueWords(24);
  if (!words.length) {
    toast('暂时没有到期错词，先去闯关吧 🌱');
    return;
  }
  openReview(words, {
    title: '到期错词复习',
    onDone: () => {
      buildMenu();
      toast('复习完成，记忆已更新 ✨');
    },
  });
});

/* ================= 触屏键盘接线 ================= */
if (isTouch) {
  buildTouchKeys();
  const input = $('hidden-input');
  if (input) {
    input.setAttribute('inputmode', 'none');
    input.setAttribute('enterkeyhint', 'done');
  }

  $('btn-mode').addEventListener('click', () => {
    touchKeysWanted = game.spelling.mode === 'type';
    syncTouchKeys();
  });

  $('btn-pause').addEventListener('click', () => {
    // Game 的监听器先执行；暂停会打开弹层，由 overlay observer 隐藏键盘。
    syncTouchKeys();
  });

  $('type-box').addEventListener('pointerdown', () => {
    touchKeysWanted = true;
    syncTouchKeys();
    setTimeout(() => game.spelling.focusInput(), 0);
  });

  $('touch-keys').addEventListener('pointerdown', (e) => {
    const action = e.target.closest('[data-tk]');
    if (action) {
      e.preventDefault();
      const kind = action.dataset.tk;
      if (kind === 'hint') game.spelling.hint();
      else if (kind === 'skip') game.spelling.skip();
      else if (kind === 'hide') {
        touchKeysWanted = false;
        syncTouchKeys();
      }
      return;
    }
    const key = e.target.closest('[data-k]');
    if (!key) return;
    e.preventDefault();
    const k = key.dataset.k;
    if (k === 'Backspace') game.spelling.backspace();
    else game.spelling.handleLetter(k);
  });

  const overlay = $('overlay');
  const syncOverlay = () => {
    const open = !overlay.classList.contains('hidden');
    document.body.classList.toggle('overlay-open', open);
    syncTouchKeys();
    if (!open && touchKeysWanted) setTimeout(() => game.spelling.focusInput(), 0);
  };
  new MutationObserver(syncOverlay).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  syncOverlay();
}

window.addEventListener('resize', fitStage);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', () => setTimeout(fitStage, 120));
window.addEventListener('pointerdown', () => audio.preload(), { once: true });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('overlay').classList.contains('hidden') && game.paused) game.resume();
});

applySkin();
if ($('lawn-bg')) $('lawn-bg').src = ART.lawn;
if ($('sun-icon')) $('sun-icon').src = ART.sun;

fitStage();
buildMenu();
