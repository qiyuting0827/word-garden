import { SPELL } from './config.js';
import { speak } from './speech.js';

const $ = (id) => document.getElementById(id);

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const EXTRA_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export class Spelling {
  constructor({ onCorrect, onWrong } = {}) {
    this.onCorrect = onCorrect || (() => {});
    this.onWrong = onWrong || (() => {});

    this.el = {
      card: $('word-card'),
      emoji: $('word-emoji'),
      zh: $('word-zh'),
      ipa: $('word-ipa'),
      slots: $('slots'),
      typeArea: $('type-area'),
      tilesArea: $('tiles-area'),
      tiles: $('tiles'),
      echo: $('type-echo'),
      input: $('hidden-input'),
      combo: $('combo'),
      hint: $('btn-hint'),
      skip: $('btn-skip'),
      speak: $('btn-speak'),
      backspace: $('btn-backspace'),
      energyFill: $('energy-fill'),
      energyNum: $('energy-num'),
      storm: $('btn-storm'),
    };

    this.mode = localStorage.getItem('word-garden-mode') || 'type';
    this.active = false;
    this.locked = false;
    this.resolving = false;
    this.queue = [];
    this.cursor = 0;
    this.current = null;
    this.typed = '';
    this.picked = [];
    this.tiles = [];
    this.mistakes = 0;
    this.hintUsed = false;
    this.timers = new Set();
    this.stats = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      combo: 0,
      maxCombo: 0,
      wrongWords: new Map(),
      startedAt: 0,
    };

    this.bindEvents();
    this.applyMode();
    this.renderEnergy(0);
  }

  bindEvents() {
    this._keydown = (e) => this.handleKeydown(e);
    this._input = (e) => this.handleInput(e);
    document.addEventListener('keydown', this._keydown);
    this.el.input.addEventListener('input', this._input);
    this.el.input.setAttribute('autocapitalize', 'off');

    this.el.speak.addEventListener('click', () => {
      if (this.current) speak(this.current.en);
    });
    this.el.hint.addEventListener('click', () => this.showHint());
    this.el.skip.addEventListener('click', () => this.skip());
    this.el.backspace.addEventListener('click', () => this.backspace());
    this.el.typeArea.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      this.focusInput();
    });
    this.el.storm.addEventListener('click', () => {
      if (this.onStorm) this.onStorm();
    });
  }

  applyMode() {
    const typing = this.mode === 'type';
    this.el.typeArea.classList.toggle('hidden', !typing);
    this.el.tilesArea.classList.toggle('hidden', typing);
    this.el.hint.classList.toggle('hidden', false);
    if (typing) this.focusInput();
  }

  setMode(mode) {
    if (mode !== 'type' && mode !== 'tiles') return;
    if (mode === this.mode) {
      this.applyMode();
      return;
    }
    this.mode = mode;
    this.typed = '';
    this.picked = [];
    this.buildTiles();
    this.applyMode();
    this.render();
    localStorage.setItem('word-garden-mode', mode);
  }

  toggleMode() {
    this.setMode(this.mode === 'type' ? 'tiles' : 'type');
    return this.mode;
  }

  focusInput() {
    if (this.mode !== 'type') return;
    try {
      this.el.input.focus({ preventScroll: true });
    } catch {
      this.el.input.focus();
    }
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

  setWords(words, { priority = [] } = {}) {
    const pset = new Set(priority);
    this.queue = shuffle(words).sort((a, b) => (pset.has(b.en) ? 1 : 0) - (pset.has(a.en) ? 1 : 0));
    this.cursor = 0;
    this.stats = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      combo: 0,
      maxCombo: 0,
      wrongWords: new Map(),
      startedAt: performance.now(),
    };
    this.renderCombo();
    this.updateWrongCount();
  }

  start() {
    this.active = true;
    this.locked = false;
    this.resolving = false;
    this.clearTimers();
    this.next(true);
    this.focusInput();
  }

  stop() {
    this.active = false;
    this.clearTimers();
  }

  next(first = false) {
    if (!this.queue.length) return;
    if (this.cursor >= this.queue.length) {
      this.queue = shuffle(this.queue);
      this.cursor = 0;
    }
    this.current = this.queue[this.cursor++];
    this.typed = '';
    this.picked = [];
    this.mistakes = 0;
    this.hintUsed = false;
    this.resolving = false;
    this.locked = false;
    this.buildTiles();
    this.render();
    this.el.hint.disabled = false;
    if (this.el.input) this.el.input.value = '';
    this.focusInput();
    if (this.active) speak(this.current.en, { rate: 0.85 });
  }

  buildTiles() {
    if (!this.current) return;
    const letters = this.current.en.split('');
    const extras = [];
    const pool = EXTRA_LETTERS.filter(c => !letters.includes(c));
    for (let i = 0; i < 2; i++) extras.push(pool[Math.floor(Math.random() * pool.length)]);
    this.tiles = shuffle([...letters, ...extras]).map(ch => ({ ch, used: false }));
  }

  render() {
    if (!this.current) return;
    const w = this.current.en;
    this.el.emoji.textContent = this.current.emoji || '📘';
    this.el.zh.textContent = this.current.zh;
    this.el.ipa.textContent = this.current.ipa || '';

    this.el.slots.innerHTML = '';
    for (let i = 0; i < w.length; i++) {
      const slot = document.createElement('span');
      slot.className = 'slot';
      if (i < this.typed.length) {
        slot.textContent = this.typed[i];
        slot.classList.add('filled');
      } else if (i === this.typed.length && !this.locked) {
        slot.classList.add('cursor');
      }
      this.el.slots.appendChild(slot);
    }

    this.el.echo.textContent = this.typed;
    this.renderTiles();
  }

  renderTiles() {
    if (!this.tiles.length) return;
    this.el.tiles.innerHTML = '';
    this.tiles.forEach((tile, index) => {
      const btn = document.createElement('button');
      btn.className = 'tile' + (tile.used ? ' used' : '');
      btn.textContent = tile.ch;
      btn.dataset.i = String(index);
      btn.addEventListener('click', () => this.pickTile(index));
      this.el.tiles.appendChild(btn);
    });
  }

  renderCombo() {
    const c = this.stats.combo;
    this.el.combo.textContent = `连击 ×${c}`;
    this.el.combo.classList.toggle('hot', c >= 3);
  }

  renderEnergy(value) {
    const v = Math.max(0, Math.min(100, value));
    this.el.energyFill.style.width = `${v}%`;
    this.el.energyNum.textContent = `${v} / 100`;
    this.el.storm.disabled = v < 100;
    this.el.storm.classList.toggle('ready', v >= 100);
  }

  setEnergy(value) {
    this.renderEnergy(value);
  }

  updateWrongCount() {
    const el = $('wrong-count');
    if (el) el.textContent = `错词 ${this.stats.wrongWords.size}`;
  }

  handleKeydown(e) {
    if (!this.active) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      if (this.locked || this.resolving) return;
      e.preventDefault();
      this.backspace();
      return;
    }

    if (e.target === this.el.input) return; // 字母交给 input 事件处理

    if (e.key.length === 1) {
      const ch = e.key.toLowerCase();
      if (ch >= 'a' && ch <= 'z') {
        e.preventDefault();
        this.handleLetter(ch);
      }
    }
  }

  handleInput(e) {
    if (!this.active) return;
    const el = e.target;
    const value = (el.value || '').toLowerCase().replace(/[^a-z]/g, '');
    el.value = '';
    if (!value) return;
    for (const ch of value) this.handleLetter(ch);
  }

  handleLetter(ch) {
    if (!this.active || this.locked || this.resolving || !this.current) return;
    if (this.typed.length >= this.current.en.length) return;
    this.typed += ch;
    this.render();
    if (this.typed.length === this.current.en.length) this.resolve();
  }

  pickTile(index) {
    if (!this.active || this.locked || this.resolving) return;
    const tile = this.tiles[index];
    if (!tile || tile.used) return;
    if (this.typed.length >= this.current.en.length) return;
    tile.used = true;
    this.picked.push(index);
    this.typed += tile.ch;
    this.render();
    if (this.typed.length === this.current.en.length) this.resolve();
  }

  backspace() {
    if (!this.current || this.locked || this.resolving) return;
    if (!this.typed.length) return;
    this.typed = this.typed.slice(0, -1);
    if (this.mode === 'tiles' && this.picked.length) {
      const index = this.picked.pop();
      if (this.tiles[index]) this.tiles[index].used = false;
    }
    this.render();
  }

  resolve() {
    if (!this.current) return;
    const answer = this.current.en;
    if (this.typed === answer) {
      this.resolveCorrect();
    } else {
      this.resolveWrong();
    }
  }

  resolveCorrect() {
    this.resolving = true;
    this.stats.attempts += 1;
    this.stats.correct += 1;
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.renderCombo();

    this.el.card.classList.remove('right');
    void this.el.card.offsetWidth;
    this.el.card.classList.add('right');

    this.onCorrect({ word: this.current, combo: this.stats.combo });

    this.later(() => {
      this.el.card.classList.remove('right');
      this.next();
    }, 380);
  }

  resolveWrong() {
    this.stats.attempts += 1;
    this.stats.wrong += 1;
    this.mistakes += 1;
    this.stats.combo = 0;
    this.renderCombo();

    const existing = this.stats.wrongWords.get(this.current.en);
    if (existing) existing.count += 1;
    else this.stats.wrongWords.set(this.current.en, { word: this.current, count: 1 });
    this.updateWrongCount();

    this.el.card.classList.remove('wrong');
    void this.el.card.offsetWidth;
    this.el.card.classList.add('wrong');

    this.onWrong({ word: this.current, typed: this.typed });

    this.locked = true;
    this.render();
    this.later(() => {
      this.el.card.classList.remove('wrong');
      this.locked = false;
      this.typed = '';
      this.picked = [];
      this.buildTiles();
      if (this.mistakes >= 2 && !this.hintUsed) {
        this.hintUsed = true;
        this.typed = this.current.en[0];
        this.el.hint.disabled = true;
        this.markTileUsed(this.current.en[0]);
      }
      this.render();
      this.focusInput();
    }, SPELL.wrongLock);
  }

  markTileUsed(ch) {
    const tile = this.tiles.find(t => !t.used && t.ch === ch);
    if (tile) tile.used = true;
  }

  showHint() {
    if (!this.current || this.hintUsed || this.locked || this.resolving) return;
    this.hintUsed = true;
    this.typed = this.current.en[0];
    this.markTileUsed(this.typed);
    this.el.hint.disabled = true;
    this.render();
    this.focusInput();
  }

  skip() {
    if (!this.current || this.resolving) return;
    this.stats.attempts += 1;
    this.stats.wrong += 1;
    this.stats.combo = 0;
    this.renderCombo();
    const existing = this.stats.wrongWords.get(this.current.en);
    if (existing) existing.count += 1;
    else this.stats.wrongWords.set(this.current.en, { word: this.current, count: 1 });
    this.updateWrongCount();
    this.onWrong({ word: this.current, typed: '', skipped: true });
    this.locked = false;
    this.next();
  }

  accuracy() {
    if (!this.stats.attempts) return 0;
    return this.stats.correct / this.stats.attempts;
  }

  wrongList() {
    return [...this.stats.wrongWords.values()].sort((a, b) => b.count - a.count);
  }
}
