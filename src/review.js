// 错词复习：独立的弹窗式拼写练习，支持键盘与点选字母
import { showDialog, closeDialog, escapeHtml } from './ui.js';
import { speak } from './speech.js';
import { markCorrect, markWrong } from './srs.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const MINUTE = 60 * 1000;
const EXTRA = 'abcdefghijklmnopqrstuvwxyz'.split('');

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class ReviewSession {
  constructor(words, { onDone, title = '错词复习' } = {}) {
    const seen = new Set();
    this.words = (words || []).filter((w) => {
      if (!w || !w.en || seen.has(w.en)) return false;
      seen.add(w.en);
      return true;
    }).slice(0, 24);
    this.onDone = onDone || (() => {});
    this.title = title;
    this.index = 0;
    this.correct = 0;
    this.wrong = 0;
    this.typed = '';
    this.tiles = [];
    this.hintUsed = false;
    this.locked = false;
    this.timers = new Set();
    this.startedAt = Date.now();
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  start() {
    if (!this.words.length) {
      this.onDone({ total: 0, correct: 0, wrong: 0 });
      return;
    }
    showDialog({
      html: `
        <div class="review-head">
          <h2>📚 ${escapeHtml(this.title)}</h2>
          <p class="dialog-sub">按遗忘曲线排序 · 第 <b id="rv-i">1</b> / <span id="rv-n">${this.words.length}</span> 个</p>
        </div>
        <div class="review-progress"><i id="rv-bar"></i></div>
        <div class="review-card" id="rv-card">
          <div class="review-emoji" id="rv-emoji">📘</div>
          <div class="review-zh" id="rv-zh"></div>
          <div class="review-ipa" id="rv-ipa"></div>
          <button class="review-speak" id="rv-speak">🔊 听发音</button>
        </div>
        <div class="review-slots" id="rv-slots"></div>
        <div class="review-input-wrap">
          <input id="rv-input" autocomplete="off" autocorrect="off" autocapitalize="off"
                 spellcheck="false" placeholder="输入单词，拼完自动检查" aria-label="输入单词" />
          <button class="review-check" id="rv-check">检查</button>
        </div>
        <div class="review-tiles" id="rv-tiles"></div>
        <div class="review-tip" id="rv-tip">可以打字，也可以点下面的字母块</div>
        <div class="review-foot">
          <button class="ghost-btn" id="rv-back">⌫ 删除</button>
          <button class="ghost-btn" id="rv-hint">💡 首字母</button>
          <button class="ghost-btn" id="rv-skip">跳过</button>
        </div>`,
    });

    $('rv-speak').addEventListener('click', () => {
      const w = this.words[this.index];
      if (w) speak(w.en);
    });
    $('rv-check').addEventListener('click', () => this.check());
    $('rv-input').addEventListener('input', (e) => {
      const value = (e.target.value || '').toLowerCase().replace(/[^a-z]/g, '');
      e.target.value = '';
      if (!value || this.locked) return;
      for (const ch of value) this.typeLetter(ch);
    });
    $('rv-input').addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.backspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.check();
      }
    });
    $('rv-back').addEventListener('click', () => this.backspace());
    $('rv-hint').addEventListener('click', () => this.hint());
    $('rv-skip').addEventListener('click', () => this.skip());

    this.load();
  }

  load() {
    if (this.index >= this.words.length) {
      this.finish();
      return;
    }
    const w = this.words[this.index];
    this.typed = '';
    this.hintUsed = false;
    this.locked = false;
    this.buildTiles();

    $('rv-i').textContent = String(this.index + 1);
    $('rv-bar').style.width = `${(this.index / this.words.length) * 100}%`;
    $('rv-emoji').textContent = w.emoji || '📘';
    $('rv-zh').textContent = w.zh || w.en;
    $('rv-ipa').textContent = w.ipa || '';
    $('rv-tip').textContent = '可以打字，也可以点下面的字母块';
    $('rv-tip').classList.remove('bad');
    $('rv-card').classList.remove('right', 'wrong');
    $('rv-input').disabled = false;
    $('rv-input').value = '';
    this.render();
    this.renderTiles();
    speak(w.en, { rate: 0.85 });
    setTimeout(() => {
      const input = $('rv-input');
      if (input && !this.locked) {
        try { input.focus({ preventScroll: true }); } catch { input.focus(); }
      }
    }, 60);
  }

  buildTiles() {
    const w = this.words[this.index];
    if (!w) return;
    const letters = w.en.split('');
    const pool = EXTRA.filter(c => !letters.includes(c));
    const extras = [pool[Math.floor(Math.random() * pool.length)], pool[Math.floor(Math.random() * pool.length)]];
    this.tiles = shuffle([...letters, ...extras]).map(ch => ({ ch, used: false }));
  }

  render() {
    const w = this.words[this.index];
    if (!w) return;
    $('rv-slots').innerHTML = '';
    for (let i = 0; i < w.en.length; i++) {
      const slot = document.createElement('span');
      slot.className = 'slot';
      if (i < this.typed.length) {
        slot.textContent = this.typed[i];
        slot.classList.add('filled');
      } else if (i === this.typed.length && !this.locked) {
        slot.classList.add('cursor');
      }
      $('rv-slots').appendChild(slot);
    }
  }

  renderTiles() {
    const box = $('rv-tiles');
    if (!box) return;
    box.innerHTML = '';
    this.tiles.forEach((tile, index) => {
      const btn = document.createElement('button');
      btn.className = 'review-tile' + (tile.used ? ' used' : '');
      btn.textContent = tile.ch;
      btn.addEventListener('click', () => this.pickTile(index));
      box.appendChild(btn);
    });
  }

  typeLetter(ch) {
    if (this.locked) return;
    const w = this.words[this.index];
    if (!w || this.typed.length >= w.en.length) return;
    this.typed += ch;
    this.render();
    if (this.typed.length === w.en.length) this.check();
  }

  pickTile(index) {
    if (this.locked) return;
    const tile = this.tiles[index];
    if (!tile || tile.used) return;
    tile.used = true;
    this.typeLetter(tile.ch);
    this.renderTiles();
  }

  backspace() {
    if (this.locked || !this.typed) return;
    const removed = this.typed.charAt(this.typed.length - 1);
    this.typed = this.typed.slice(0, -1);
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      if (this.tiles[i].used && this.tiles[i].ch === removed) {
        this.tiles[i].used = false;
        break;
      }
    }
    this.render();
    this.renderTiles();
    const input = $('rv-input');
    if (input) {
      try { input.focus({ preventScroll: true }); } catch { input.focus(); }
    }
  }

  hint() {
    if (this.locked || this.hintUsed) return;
    const w = this.words[this.index];
    if (!w) return;
    this.hintUsed = true;
    this.typed = w.en[0];
    const tile = this.tiles.find(t => !t.used && t.ch === w.en[0]);
    if (tile) tile.used = true;
    this.render();
    this.renderTiles();
    $('rv-tip').textContent = '已提示首字母，继续加油';
    $('rv-input').focus();
  }

  check() {
    if (this.locked) return;
    const w = this.words[this.index];
    if (!w) return;
    if (!this.typed) {
      $('rv-tip').textContent = '先拼出单词再检查';
      return;
    }
    if (this.typed === w.en) this.succeed(w);
    else this.fail(w);
  }

  succeed(w) {
    this.locked = true;
    this.correct += 1;
    markCorrect(w);
    audio.play('sun', { volume: 0.4, rate: 1.1 });
    $('rv-card').classList.add('right');
    $('rv-tip').textContent = '✓ 拼对了，记忆 +1';
    $('rv-tip').classList.remove('bad');
    $('rv-input').disabled = true;
    this.later(() => this.next(), 520);
  }

  fail(w) {
    this.locked = true;
    this.wrong += 1;
    markWrong(w, { delay: 10 * MINUTE, lapse: true });
    audio.play('chomp', { volume: 0.3, rate: 0.9 });
    $('rv-card').classList.add('wrong');
    $('rv-tip').textContent = `正确拼写：${w.en}`;
    $('rv-tip').classList.add('bad');
    $('rv-input').disabled = true;
    this.later(() => this.next(), 1600);
  }

  skip() {
    if (this.locked) return;
    const w = this.words[this.index];
    if (!w) return;
    this.locked = true;
    this.wrong += 1;
    markWrong(w, { delay: 10 * MINUTE, lapse: true });
    $('rv-tip').textContent = `正确拼写：${w.en}`;
    $('rv-tip').classList.add('bad');
    this.later(() => this.next(), 1400);
  }

  next() {
    this.index += 1;
    this.load();
  }

  finish() {
    this.clearTimers();
    const total = this.correct + this.wrong;
    const pct = total ? Math.round((this.correct / total) * 100) : 0;
    $('rv-bar').style.width = '100%';
    showDialog({
      html: `
        <h2>复习完成 🌱</h2>
        <p class="dialog-sub">这些单词会按遗忘曲线再次出现</p>
        <div class="stats">
          <div class="stat"><b>${this.correct}</b><span>一次拼对</span></div>
          <div class="stat"><b>${this.wrong}</b><span>需要再练</span></div>
          <div class="stat"><b>${pct}%</b><span>本次正确率</span></div>
          <div class="stat"><b>${Math.max(1, Math.round((Date.now() - this.startedAt) / 1000))}s</b><span>用时</span></div>
        </div>`,
      actions: [{
        label: '继续',
        cls: 'gold',
        onClick: () => {
          closeDialog();
          this.onDone({ total, correct: this.correct, wrong: this.wrong });
        },
      }],
    });
    audio.play('win', { volume: 0.35 });
  }

  stop() {
    this.clearTimers();
    closeDialog();
  }
}
