import {
  GRID, SPAWN_X, HOUSE_X, MOWER_X, PLANTS, ZOMBIES,
  cellCenter, rowY, buildSpawns, totalZombies, DIFF_HP_SCALE, SPELL, WAVES, ART,
} from './config.js';
import { classic } from './skin.js';
import { audio } from './audio.js';
import { toast, showDialog, closeDialog } from './ui.js';
import { Spelling } from './spelling.js';
import { markWrong, markCorrect, dueWords } from './srs.js';

const $ = (id) => document.getElementById(id);

const LAYER = {
  grid: null, mower: null, plant: null, zombie: null,
  projectile: null, sun: null, fx: null,
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  constructor({ onFinish, onExit } = {}) {
    this.onFinish = onFinish || (() => {});
    this.onExit = onExit || (() => {});

    LAYER.grid = $('grid-layer');
    LAYER.mower = $('mower-layer');
    LAYER.plant = $('plant-layer');
    LAYER.zombie = $('zombie-layer');
    LAYER.projectile = $('projectile-layer');
    LAYER.sun = $('sun-layer');
    LAYER.fx = $('fx-layer');

    this.spelling = new Spelling({
      onCorrect: (info) => this.onWordCorrect(info),
      onWrong: (info) => this.onWordWrong(info),
    });

    this.boundKey = (e) => this.handleKey(e);
    document.addEventListener('keydown', this.boundKey);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.running && !this.paused) this.pause();
    });

    $('btn-pause').addEventListener('click', () => this.togglePause());
    $('btn-mode').addEventListener('click', () => this.toggleMode());
    $('btn-sound').addEventListener('click', () => this.toggleSound());
    $('seedbar').addEventListener('click', (e) => {
      const card = e.target.closest('.seed');
      if (card) this.selectPlant(card.dataset.type);
      this.spelling.focusInput();
    });
    $('grid-layer').addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (cell) this.tryPlant(Number(cell.dataset.col), Number(cell.dataset.row));
      this.spelling.focusInput();
    });
    $('game').addEventListener('pointerdown', (e) => {
      if (e.target.closest('#btn-pause, #btn-mode, #btn-sound')) return;
      this.spelling.focusInput();
    });

    this.raf = 0;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
  }

  /* ================= 开始一局 ================= */
  start({ unit, diff }) {
    this.unit = unit;
    this.diff = diff;
    this.spawns = buildSpawns(diff);
    this.total = totalZombies(diff);
    this.hpScale = DIFF_HP_SCALE[diff] || 1;

    this.sun = 75;
    this.energy = 0;
    this.elapsed = 0;
    this.spawnIndex = 0;
    this.killed = 0;
    this.zombies = [];
    this.plants = [];
    this.projectiles = [];
    this.suns = [];
    this.mowers = [];
    this.grid = Array.from({ length: GRID.rows }, () => Array(GRID.cols).fill(null));
    this.cooldowns = {};
    this.selected = null;
    this.sunTimer = 5000;
    this.groanTimer = 7000;
    this.stormReadyShown = false;
    this.sessionWrong = new Set();

    this.paused = false;
    this.running = true;
    this.lastTime = performance.now();

    closeDialog();
    $('game').classList.remove('hidden');
    this.clearStage();
    this.buildGrid();
    this.buildSeedbar();
    this.buildMowers();
    this.updateSun(0);
    this.updateWave();

    const due = new Set(dueWords(50).map(w => w.en));
    this.spelling.setWords(unit.words, { priority: [...due] });
    this.spelling.setMode(localStorage.getItem('word-garden-mode') || this.spelling.mode);
    this.spelling.setEnergy(0);
    this.spelling.start();

    $('level-name').textContent = `${unit.name} · ${['', '简单', '普通', '困难'][diff]}`;
    $('footer-tip').textContent = '拼对单词 → 阳光 +10 · 魔法弹 · 连击加成';
    $('btn-sound').textContent = audio.muted ? '🔇' : '🔊';
    $('btn-mode').textContent = this.spelling.mode === 'type' ? '⌨️' : '🔤';

    this.updateCardStates(true);
    audio.play('ready');
    toast('准备迎战僵尸！', 1600);

    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  clearStage() {
    Object.values(LAYER).forEach(layer => { if (layer) layer.innerHTML = ''; });
    const toastEl = $('toast');
    if (toastEl) toastEl.className = 'toast';
  }

  buildGrid() {
    const frag = document.createDocumentFragment();
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.col = c;
        cell.dataset.row = r;
        const pos = cellCenter(c, r);
        cell.style.left = `${pos.x - GRID.cw / 2}px`;
        cell.style.top = `${pos.y - GRID.ch / 2}px`;
        cell.style.width = `${GRID.cw}px`;
        cell.style.height = `${GRID.ch}px`;
        cell.addEventListener('pointerenter', () => {
          if (!this.selected || this.grid[r][c]) return;
          cell.classList.add('hover');
        });
        cell.addEventListener('pointerleave', () => cell.classList.remove('hover'));
        frag.appendChild(cell);
      }
    }
    LAYER.grid.appendChild(frag);
  }

  buildSeedbar() {
    const bar = $('seedbar');
    bar.innerHTML = '';
    Object.entries(PLANTS).forEach(([type, def], index) => {
      const card = document.createElement('button');
      card.className = 'seed';
      card.dataset.type = type;
      card.innerHTML = `
        <div class="thumb"><img src="${def.card}" alt="${def.name}" draggable="false" /></div>
        <div class="pname">${def.name}</div>
        <div class="cost">${def.cost}</div>
        <div class="cool"></div>
        <div class="key">${index + 1}</div>
      `;
      bar.appendChild(card);
    });
  }

  buildMowers() {
    for (let r = 0; r < GRID.rows; r++) {
      const el = document.createElement('img');
      el.className = 'mower';
      el.src = ART.mower;
      el.style.left = `${MOWER_X}px`;
      el.style.top = `${rowY(r) + 44}px`;
      el.style.width = classic ? '70px' : '76px';
      el.style.height = classic ? '57px' : '62px';
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -100%)';
      el.style.pointerEvents = 'none';
      LAYER.mower.appendChild(el);
      this.mowers.push({ row: r, el, x: MOWER_X, active: false, used: false });
    }
  }

  /* ================= 主循环 ================= */
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(60, now - this.lastTime);
    this.lastTime = now;
    if (!this.paused) this.update(dt);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.elapsed += dt;

    // 刷僵尸
    while (this.spawnIndex < this.spawns.length && this.elapsed >= this.spawns[this.spawnIndex].at) {
      this.spawnZombie(this.spawns[this.spawnIndex]);
      this.spawnIndex += 1;
    }

    // 天降阳光
    this.sunTimer -= dt;
    if (this.sunTimer <= 0) {
      this.sunTimer = rand(8000, 11000);
      this.spawnSkySun();
    }

    // 僵尸低吼
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = rand(7000, 12000);
      if (this.zombies.some(z => !z.dead)) audio.play('groan', { volume: 0.25, rate: rand(0.9, 1.1) });
    }

    this.updatePlants(dt);
    this.updateProjectiles(dt);
    this.updateZombies(dt);
    this.updateSuns(dt);
    this.updateMowers(dt);
    this.updateCards(dt);
    this.updateWave();
    this.checkEnd();
  }

  /* ================= 植物 ================= */
  tryPlant(col, row) {
    if (!this.running || this.paused || !this.selected) return;
    const type = this.selected;
    const def = PLANTS[type];
    if (!def) return;
    if (this.grid[row][col]) {
      toast('这里已经有植物了');
      return;
    }
    if (this.sun < def.cost) {
      toast('阳光不够，去拼单词吧！');
      audio.play('click', { volume: 0.4 });
      return;
    }
    if ((this.cooldowns[type] || 0) > performance.now()) {
      toast('这个植物还在冷却');
      return;
    }

    this.updateSun(-def.cost);
    this.cooldowns[type] = performance.now() + def.cooldown;

    const pos = cellCenter(col, row);
    const el = document.createElement('div');
    el.className = 'plant spawn';
    el.dataset.type = type;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y + def.anchorY}px`;
    el.style.width = `${def.w}px`;
    el.style.height = `${def.h}px`;
    el.innerHTML = `<img src="${def.img}" draggable="false" alt="${def.name}" /><div class="hpbar"><i></i></div>`;
    LAYER.plant.appendChild(el);

    const plant = {
      type, def, col, row,
      x: pos.x, y: pos.y,
      hp: def.hp, maxHp: def.hp,
      el, img: el.querySelector('img'),
      bar: el.querySelector('.hpbar'),
      fill: el.querySelector('.hpbar i'),
      lastAction: this.elapsed,
      plantedAt: this.elapsed,
      dead: false,
    };
    this.plants.push(plant);
    this.grid[row][col] = plant;

    audio.play('plant', { volume: 0.4 });
    setTimeout(() => el.classList.remove('spawn'), 400);
    this.updateCardStates();
  }

  updatePlants(dt) {
    for (const p of this.plants) {
      if (p.dead) continue;
      const def = p.def;

      if (def.produce) {
        if (this.elapsed - p.lastAction >= def.produce) {
          p.lastAction = this.elapsed;
          this.spawnPlantSun(p);
        }
      }

      if (def.fire) {
        const target = this.frontZombieInRow(p.row, p.x);
        if (target && this.elapsed - p.lastAction >= def.fire) {
          p.lastAction = this.elapsed;
          this.firePea(p, def);
        }
      }

      if (def.fuse && this.elapsed - p.plantedAt >= def.fuse) {
        this.explode(p);
      }

      if (p.type === 'wallnut' && def.imgs) {
        const ratio = p.hp / p.maxHp;
        const want = ratio > 0.66 ? def.imgs[0] : ratio > 0.33 ? def.imgs[1] : def.imgs[2];
        if (p.img.getAttribute('src') !== want) p.img.src = want;
      }
    }
  }

  firePea(plant, def) {
    const el = document.createElement('div');
    el.className = `pea${def.projectile === 'ice' ? ' ice' : ''}`;
    const x = plant.x + 26;
    const y = plant.y - 24;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    LAYER.projectile.appendChild(el);
    this.projectiles.push({
      kind: 'pea', x, y, row: plant.row,
      damage: def.damage, slow: def.slow || 0, el,
    });
    audio.play('shoot', { volume: 0.16, rate: rand(1.1, 1.3) });
  }

  explode(plant) {
    plant.dead = true;
    this.grid[plant.row][plant.col] = null;
    plant.el.remove();
    const fx = document.createElement('div');
    if (classic && ART.boom) {
      fx.className = 'boom-gif';
      fx.innerHTML = `<img src="${ART.boom}" alt="" draggable="false" />`;
      fx.style.left = `${plant.x}px`;
      fx.style.top = `${plant.y}px`;
      LAYER.fx.appendChild(fx);
      setTimeout(() => fx.remove(), 900);
    } else {
      fx.className = 'boom';
      fx.style.left = `${plant.x}px`;
      fx.style.top = `${plant.y}px`;
      LAYER.fx.appendChild(fx);
      setTimeout(() => fx.remove(), 520);
    }
    audio.play('cherry');
    audio.play('explode', { volume: 0.5 });
    this.shake();

    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - plant.x, z.y - plant.y);
      if (d <= plant.def.radius) this.damageZombie(z, plant.def.damage, { silent: true });
    }
    this.plants = this.plants.filter(p => !p.dead);
  }

  frontZombieInRow(row, minX) {
    let best = null;
    for (const z of this.zombies) {
      if (z.dead || z.row !== row) continue;
      if (z.x < minX - 20) continue;
      if (!best || z.x < best.x) best = z;
    }
    return best;
  }

  /* ================= 僵尸 ================= */
  spawnZombie(spawn) {
    const type = spawn.type;
    const def = ZOMBIES[type];
    const row = Math.floor(Math.random() * GRID.rows);
    const x = SPAWN_X + rand(-30, 50);
    const y = rowY(row) + 42;

    const el = document.createElement('div');
    el.className = 'zombie walking';
    el.dataset.type = type;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${def.w}px`;
    el.style.height = `${def.h}px`;
    el.innerHTML = `<img src="${def.img}" draggable="false" alt="${def.name}" /><div class="hpbar"><i></i></div>`;
    LAYER.zombie.appendChild(el);

    const z = {
      type, def, row, x, y, el,
      img: el.querySelector('img'),
      bar: el.querySelector('.hpbar'),
      fill: el.querySelector('.hpbar i'),
      hp: Math.round(def.hp * this.hpScale),
      maxHp: Math.round(def.hp * this.hpScale),
      state: 'walk',
      slowUntil: 0,
      nextChomp: 0,
      dead: false,
      flag: !!spawn.flag,
    };
    this.zombies.push(z);

    if (spawn.flag) {
      audio.play('huge', { volume: 0.5 });
      toast('一大波僵尸正在接近！', 2000);
      this.shake();
    }
  }

  updateZombies(dt) {
    const now = this.elapsed;
    for (const z of this.zombies) {
      if (z.dead) continue;

      const slowed = z.slowUntil > now;
      z.el.classList.toggle('slow', slowed);

      const target = this.plantToEat(z);
      const state = target ? 'eat' : 'walk';
      if (z.state !== state) {
        z.state = state;
        const src = state === 'eat' ? z.def.attack : z.def.walk;
        if (src && z.img.getAttribute('src') !== src) z.img.src = src;
      }
      z.el.classList.toggle('eating', !!target);
      z.el.classList.toggle('walking', !target);
      if (target) {
        target.hp -= z.def.dps * (dt / 1000);
        this.updateHp(target);
        z.nextChomp -= dt;
        if (z.nextChomp <= 0) {
          z.nextChomp = 700;
          audio.play('chomp', { volume: 0.18, rate: rand(0.9, 1.15) });
        }
        if (target.hp <= 0) this.killPlant(target);
      } else {
        const speed = z.def.speed * (slowed ? 0.45 : 1);
        z.x -= speed * (dt / 1000);
        z.el.style.left = `${z.x}px`;
      }

      if (z.x <= HOUSE_X) this.houseBreach(z);
    }

    // 清理已经消失的僵尸
    this.zombies = this.zombies.filter(z => !z.dead || z.el.isConnected);
  }

  plantToEat(z) {
    let best = null;
    for (const p of this.plants) {
      if (p.dead || p.row !== z.row) continue;
      if (z.x <= p.x + 30 && z.x >= p.x - 34) {
        if (!best || p.x > best.x) best = p;
      }
    }
    return best;
  }

  updateHp(entity) {
    const ratio = Math.max(0, entity.hp / entity.maxHp);
    if (entity.fill) {
      entity.fill.style.width = `${ratio * 100}%`;
      entity.fill.classList.toggle('low', ratio < 0.4);
    }
    if (entity.bar) entity.bar.classList.add('show');
  }

  killPlant(plant) {
    plant.dead = true;
    this.grid[plant.row][plant.col] = null;
    plant.el.remove();
    this.plants = this.plants.filter(p => p !== plant);
    audio.play('chomp', { volume: 0.3 });
    this.floatText(plant.x, plant.y - 20, '💥', 'bad');
  }

  damageZombie(z, amount, { slow = 0, silent = false } = {}) {
    if (z.dead) return;
    z.hp -= amount;
    if (slow) z.slowUntil = this.elapsed + slow;
    this.updateHp(z);
    if (!silent) {
      z.el.classList.remove('hit');
      void z.el.offsetWidth;
      z.el.classList.add('hit');
      audio.play('hit', { volume: 0.2, rate: rand(1, 1.25) });
    }
    this.floatText(z.x, z.y - z.def.h * 0.7, `-${Math.round(amount)}`);
    if (z.hp <= 0) this.killZombie(z);
  }

  killZombie(z) {
    z.dead = true;
    z.state = 'die';
    if (z.def.die) {
      z.img.src = z.def.die;
      z.el.classList.add('dying-gif');
      setTimeout(() => z.el.remove(), 900);
    } else {
      z.el.classList.add('dying');
      setTimeout(() => z.el.remove(), 750);
    }
    this.killed += 1;
    this.energy = Math.min(100, this.energy + 6);
    this.spelling.setEnergy(this.energy);
    audio.play('groan', { volume: 0.2, rate: 0.8 });
  }

  houseBreach(z) {
    if (z.breached) return;
    const mower = this.mowers.find(m => m.row === z.row && !m.used);
    if (mower) {
      z.breached = true;
      mower.used = true;
      mower.active = true;
      audio.play('mower', { volume: 0.55 });
      toast('小推车启动！', 1200);
      this.shake();
      return;
    }
    const activeMower = this.mowers.find(m => m.row === z.row && m.active);
    if (activeMower && activeMower.x < z.x + 80) {
      // 小推车还在僵尸左侧，马上就会碾过来
      z.breached = true;
      return;
    }
    this.finish(false);
  }

  updateMowers(dt) {
    for (const mower of this.mowers) {
      if (!mower.active) continue;
      mower.x += 820 * (dt / 1000);
      mower.el.style.left = `${mower.x}px`;
      for (const z of this.zombies) {
        if (z.dead || z.row !== mower.row) continue;
        if (z.x > mower.x - 40 && z.x < mower.x + 90) {
          this.damageZombie(z, 9999, { silent: true });
        }
      }
      if (mower.x > 1420) {
        mower.active = false;
        mower.el.remove();
      }
    }
  }

  /* ================= 子弹 ================= */
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      if (p.kind === 'bolt') {
        p.x -= 900 * (dt / 1000);
        p.el.style.left = `${p.x}px`;
        const hit = this.zombieAt(p.row, p.x, 46);
        if (hit) {
          this.damageZombie(hit, p.damage);
          p.dead = true;
          p.el.remove();
          continue;
        }
        if (p.x < 0) {
          p.dead = true;
          p.el.remove();
        }
        continue;
      }

      p.x += 620 * (dt / 1000);
      p.el.style.left = `${p.x}px`;
      const hit = this.zombieAt(p.row, p.x, 34);
      if (hit) {
        this.damageZombie(hit, p.damage, { slow: p.slow });
        if (p.slow) audio.play('freeze', { volume: 0.15 });
        p.dead = true;
        p.el.remove();
      } else if (p.x > 1410) {
        p.dead = true;
        p.el.remove();
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  zombieAt(row, x, tolerance) {
    let best = null;
    for (const z of this.zombies) {
      if (z.dead || z.row !== row) continue;
      if (Math.abs(x - (z.x - 12)) <= tolerance) {
        if (!best || z.x < best.x) best = z;
      }
    }
    return best;
  }

  /* ================= 阳光 ================= */
  spawnSkySun() {
    const x = rand(GRID.x + 30, GRID.x + GRID.cols * GRID.cw - 30);
    const targetY = rand(110, 520);
    this.createSun(x, -40, targetY, true);
  }

  spawnPlantSun(plant) {
    this.createSun(plant.x + rand(-12, 12), plant.y - 40, plant.y + 20, false);
    audio.play('sun', { volume: 0.2, rate: 1.2 });
  }

  createSun(x, y, targetY, falling) {
    const el = document.createElement('div');
    el.className = 'sun' + (falling ? ' falling' : '');
    el.innerHTML = `<img src="${ART.sun}" alt="阳光" draggable="false" />`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    LAYER.sun.appendChild(el);

    const sun = { x, y, targetY, falling, el, life: 12000, landed: !falling };
    el.addEventListener('click', () => this.collectSun(sun));
    this.suns.push(sun);
  }

  updateSuns(dt) {
    for (const s of this.suns) {
      if (s.dead) continue;
      if (s.falling) {
        s.y += 62 * (dt / 1000);
        if (s.y >= s.targetY) {
          s.y = s.targetY;
          s.falling = false;
          s.el.classList.remove('falling');
        }
        s.el.style.top = `${s.y}px`;
      } else {
        s.life -= dt;
        if (s.life <= 0) {
          s.dead = true;
          s.el.remove();
        }
      }
    }
    this.suns = this.suns.filter(s => !s.dead);
  }

  collectSun(sun) {
    if (sun.dead) return;
    sun.dead = true;
    sun.el.classList.add('collect');
    setTimeout(() => sun.el.remove(), 450);
    this.updateSun(25);
    audio.play('sun');
    this.floatText(sun.x, sun.y - 20, '+25');
  }

  /* ================= 拼写奖励 ================= */
  onWordCorrect({ word, combo }) {
    if (!this.sessionWrong.has(word.en)) markCorrect(word);
    let gain = SPELL.sunPerWord;
    if (combo >= SPELL.comboBonusAt) gain += SPELL.comboBonus;
    this.updateSun(gain);
    this.energy = Math.min(100, this.energy + SPELL.energyPerWord);
    this.spelling.setEnergy(this.energy);

    // 朝最靠前的僵尸发射魔法弹
    const target = this.zombies
      .filter(z => !z.dead)
      .sort((a, b) => a.x - b.x)[0];
    if (target) {
      const el = document.createElement('div');
      el.className = 'bolt';
      el.textContent = word.en[0].toUpperCase();
      const x = 1390;
      el.style.left = `${x}px`;
      el.style.top = `${rowY(target.row) - 10}px`;
      LAYER.projectile.appendChild(el);
      this.projectiles.push({
        kind: 'bolt', x, y: rowY(target.row) - 10, row: target.row,
        damage: SPELL.boltDamage, el,
      });
      this.floatText(target.x, target.y - 70, '✦', '');
    }

    this.floatText(rand(1150, 1320), rand(180, 560), `+${gain}`);
    audio.play('sun', { volume: 0.3, rate: 1.15 });

    if (this.energy >= 100 && !this.stormReadyShown) {
      this.stormReadyShown = true;
      toast('⚡ 单词风暴已就绪！', 1800);
    }
    if (this.energy < 100) this.stormReadyShown = false;
  }

  onWordWrong({ word, skipped }) {
    const first = !this.sessionWrong.has(word.en);
    this.sessionWrong.add(word.en);
    markWrong(word, { lapse: first });
    if (skipped) toast(`已跳过：${word.en} ${word.zh}`, 1500);
    else toast('再试一次，你可以的！', 1100);
    audio.play('chomp', { volume: 0.25, rate: 0.85 });
  }

  useStorm() {
    if (this.energy < 100 || !this.running || this.paused) return;
    this.energy = 0;
    this.spelling.setEnergy(0);
    this.stormReadyShown = false;

    audio.play('explode', { volume: 0.7 });
    audio.play('siren', { volume: 0.4 });
    this.shake();
    const fx = document.createElement('div');
    fx.className = 'boom';
    fx.style.left = '700px';
    fx.style.top = '300px';
    fx.style.width = '1400px';
    fx.style.height = '900px';
    LAYER.fx.appendChild(fx);
    setTimeout(() => fx.remove(), 520);

    for (const z of this.zombies) {
      if (!z.dead) this.damageZombie(z, SPELL.stormDamage, { slow: 3000, silent: true });
    }
    toast('⚡ 单词风暴横扫草坪！', 1800);
  }

  /* ================= HUD ================= */
  updateSun(delta) {
    this.sun = Math.max(0, this.sun + delta);
    $('sun-count').textContent = this.sun;
    this.updateCardStates();
  }

  updateCardStates() {
    const now = performance.now();
    document.querySelectorAll('.seed').forEach(card => {
      const type = card.dataset.type;
      const def = PLANTS[type];
      const readyAt = this.cooldowns[type] || 0;
      const remain = Math.max(0, readyAt - now);
      const ratio = def.cooldown ? remain / def.cooldown : 0;
      const cool = card.querySelector('.cool');
      if (cool) cool.style.clipPath = `inset(${(1 - Math.min(1, ratio)) * 100}% 0 0 0)`;
      card.classList.toggle('disabled', remain > 0);
      card.classList.toggle('cant', this.sun < def.cost);
      card.classList.toggle('selected', this.selected === type);
    });
  }

  updateWave() {
    const total = this.total || 1;
    const progress = Math.min(1, this.killed / total);
    $('wave-fill').style.width = `${progress * 100}%`;
    const current = Math.min(
      (WAVES[this.diff] || WAVES[1]).length,
      Math.max(1, (this.spawnIndex ? this.spawns[this.spawnIndex - 1].wave : 0) + 1),
    );
    $('wave-text').textContent = `第 ${current} / ${(WAVES[this.diff] || WAVES[1]).length} 波 · 已消灭 ${this.killed}/${total}`;
  }

  updateCards() {
    this._cardTick = (this._cardTick || 0) + 1;
    if (this._cardTick % 6 === 0) this.updateCardStates();
  }

  selectPlant(type) {
    if (!this.running || this.paused) return;
    if (this.selected === type) {
      this.selected = null;
    } else {
      this.selected = type;
      audio.play('click', { volume: 0.35 });
    }
    this.updateCardStates();
  }

  handleKey(e) {
    if (!this.running) return;
    if (e.key === 'Escape') {
      this.selected = null;
      this.updateCardStates();
      if (this.paused) this.resume();
      return;
    }
    if (e.key.toLowerCase() === 'p') {
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= Object.keys(PLANTS).length) {
      this.selectPlant(Object.keys(PLANTS)[n - 1]);
    }
  }

  /* ================= 特效 ================= */
  floatText(x, y, text, cls = '') {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`.trim();
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    LAYER.fx.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  shake() {
    const lawn = $('lawn');
    lawn.classList.remove('shake');
    void lawn.offsetWidth;
    lawn.classList.add('shake');
    setTimeout(() => lawn.classList.remove('shake'), 400);
  }

  toggleMode() {
    const mode = this.spelling.toggleMode();
    $('btn-mode').textContent = mode === 'type' ? '⌨️' : '🔤';
    toast(mode === 'type' ? '键盘拼写模式' : '点选字母模式', 1000);
  }

  toggleSound() {
    audio.setMuted(!audio.muted);
    $('btn-sound').textContent = audio.muted ? '🔇' : '🔊';
  }

  /* ================= 暂停 / 结束 ================= */
  togglePause() {
    if (!this.running) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.spelling.active = false;
    showDialog({
      html: `
        <h2>游戏暂停</h2>
        <p class="dialog-sub">僵尸也在等你哦</p>
        <div class="stats">
          <div class="stat"><b>${this.killed}</b><span>消灭僵尸</span></div>
          <div class="stat"><b>${this.sun}</b><span>阳光</span></div>
          <div class="stat"><b>${this.spelling.stats.correct}</b><span>拼对单词</span></div>
          <div class="stat"><b>${Math.round(this.spelling.accuracy() * 100)}%</b><span>正确率</span></div>
        </div>`,
      actions: [
        { label: '继续游戏', cls: 'gold', onClick: () => this.resume() },
        { label: '重新开始', cls: 'gray', onClick: () => this.restart() },
        { label: '返回菜单', cls: 'gray', onClick: () => this.exit() },
      ],
    });
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
    closeDialog();
    this.spelling.active = true;
    this.spelling.focusInput();
  }

  restart() {
    closeDialog();
    this.start({ unit: this.unit, diff: this.diff });
  }

  exit() {
    this.running = false;
    this.paused = false;
    this.spelling.stop();
    cancelAnimationFrame(this.raf);
    closeDialog();
    $('game').classList.add('hidden');
    this.onExit();
  }

  checkEnd() {
    if (!this.running) return;
    if (this.spawnIndex < this.spawns.length) return;
    if (this.elapsed < this.spawns[this.spawns.length - 1].at + 1500) return;
    if (this.zombies.some(z => !z.dead)) return;
    this.finish(true);
  }

  finish(win) {
    if (!this.running) return;
    this.running = false;
    this.spelling.stop();
    cancelAnimationFrame(this.raf);

    if (win) {
      audio.play('win', { volume: 0.5 });
    } else {
      audio.play('lose', { volume: 0.5 });
      audio.play('evillaugh', { volume: 0.4 });
    }

    const accuracy = this.spelling.accuracy();
    const seconds = Math.round((performance.now() - this.spelling.stats.startedAt) / 1000);
    this.onFinish({
      win,
      unit: this.unit,
      diff: this.diff,
      stars: win ? (accuracy >= 0.9 ? 3 : accuracy >= 0.75 ? 2 : accuracy >= 0.6 ? 1 : 0) : 0,
      accuracy,
      correct: this.spelling.stats.correct,
      wrong: this.spelling.stats.wrong,
      maxCombo: this.spelling.stats.maxCombo,
      killed: this.killed,
      total: this.total,
      seconds,
      wrongWords: this.spelling.wrongList(),
    });
  }
}
