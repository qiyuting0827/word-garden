// 游戏数值与关卡配置（坐标均为草坪局部坐标：1400 x 600）
import { classic, asset } from './skin.js';

export const STAGE = { w: 1760, h: 760 };

export const GRID = {
  x: 257,
  y: 70,
  cols: 9,
  rows: 5,
  cw: 81.4,
  ch: 98.6,
};

export const HOUSE_X = 236;      // 僵尸越过此线触发小推车
export const SPAWN_X = 1075;     // 僵尸出生点
export const MOWER_X = 232;

export const cellCenter = (col, row) => ({
  x: GRID.x + (col + 0.5) * GRID.cw,
  y: GRID.y + (row + 0.5) * GRID.ch,
});

export const rowY = (row) => GRID.y + (row + 0.5) * GRID.ch;

const pvz = (p) => `./assets/pvz/${p}`;
const orig = (p) => `./assets/original/${p}`;

export const PLANTS = {
  sunflower: {
    name: '向日葵', cost: 50, hp: 300, cooldown: 5000,
    img: asset(pvz('plants/sunflower.gif'), orig('plants/sunflower.svg')),
    card: asset(pvz('cards/sunflower.png'), orig('plants/sunflower.svg')),
    w: classic ? 78 : 94, h: classic ? 79 : 96, anchorY: classic ? 22 : 30,
    produce: 9000, sunValue: 25,
  },
  peashooter: {
    name: '豌豆射手', cost: 100, hp: 300, cooldown: 5000,
    img: asset(pvz('plants/peashooter.gif'), orig('plants/peashooter.svg')),
    card: asset(pvz('cards/peashooter.png'), orig('plants/peashooter.svg')),
    w: classic ? 74 : 94, h: classic ? 74 : 94, anchorY: classic ? 20 : 26,
    fire: 1450, damage: 20, projectile: 'pea',
  },
  wallnut: {
    name: '坚果墙', cost: 50, hp: 1600, cooldown: 12000,
    img: asset(pvz('plants/wallnut.gif'), orig('plants/wallnut.svg')),
    card: asset(pvz('cards/wallnut.png'), orig('plants/wallnut.svg')),
    w: classic ? 68 : 82, h: classic ? 76 : 94, anchorY: classic ? 18 : 24,
    imgs: classic
      ? [pvz('plants/wallnut.gif'), pvz('plants/wallnut_cracked1.gif'), pvz('plants/wallnut_cracked2.gif')]
      : [orig('plants/wallnut.svg'), orig('plants/wallnut_cracked1.svg'), orig('plants/wallnut_cracked2.svg')],
  },
  snowpea: {
    name: '寒冰射手', cost: 175, hp: 300, cooldown: 8000,
    img: asset(pvz('plants/snowpea.gif'), orig('plants/snowpea.svg')),
    card: asset(pvz('cards/snowpea.png'), orig('plants/snowpea.svg')),
    w: classic ? 74 : 94, h: classic ? 74 : 94, anchorY: classic ? 20 : 26,
    fire: 1600, damage: 20, projectile: 'ice', slow: 3000,
  },
  cherrybomb: {
    name: '樱桃炸弹', cost: 150, hp: 9999, cooldown: 18000,
    img: asset(pvz('plants/cherrybomb.gif'), orig('plants/cherrybomb.svg')),
    card: asset(pvz('cards/cherrybomb.png'), orig('plants/cherrybomb.svg')),
    w: classic ? 96 : 86, h: classic ? 70 : 86, anchorY: classic ? 16 : 22,
    fuse: 900, damage: 900, radius: 200,
  },
};

export const ZOMBIES = {
  normal: {
    name: '普通僵尸', hp: 100, speed: 17, dps: 32,
    img: asset(pvz('zombies/zombie_walk.gif'), orig('zombies/zombie.svg')),
    walk: asset(pvz('zombies/zombie_walk.gif'), orig('zombies/zombie.svg')),
    attack: asset(pvz('zombies/zombie_attack.gif'), orig('zombies/zombie.svg')),
    die: classic ? pvz('zombies/zombie_die.gif') : null,
    w: classic ? 146 : 124, h: classic ? 127 : 118,
  },
  cone: {
    name: '路障僵尸', hp: 220, speed: 16, dps: 32,
    img: asset(pvz('zombies/cone_walk.gif'), orig('zombies/cone.svg')),
    walk: asset(pvz('zombies/cone_walk.gif'), orig('zombies/cone.svg')),
    attack: asset(pvz('zombies/cone_attack.gif'), orig('zombies/cone.svg')),
    die: classic ? pvz('zombies/zombie_die.gif') : null,
    w: classic ? 146 : 124, h: classic ? 127 : 122,
  },
  bucket: {
    name: '铁桶僵尸', hp: 380, speed: 14, dps: 34,
    img: asset(pvz('zombies/bucket_walk.gif'), orig('zombies/bucket.svg')),
    walk: asset(pvz('zombies/bucket_walk.gif'), orig('zombies/bucket.svg')),
    attack: asset(pvz('zombies/bucket_attack.gif'), orig('zombies/bucket.svg')),
    die: classic ? pvz('zombies/zombie_die.gif') : null,
    w: classic ? 146 : 126, h: classic ? 127 : 124,
  },
};

export const ART = {
  sun: asset(pvz('sun.gif'), orig('sun.svg')),
  mower: asset(pvz('lawnmower.png'), orig('mower.svg')),
  lawn: asset(pvz('lawn.jpg'), orig('lawn.svg')),
  menu: asset(pvz('lawn.jpg'), orig('lawn.svg')),
  boom: classic ? pvz('plants/boom.gif') : null,
};

export const WAVES = {
  1: [
    { at: 15000, flag: false, list: [['normal', 2, 6000]] },
    { at: 32000, flag: false, list: [['normal', 3, 4000], ['cone', 1, 1500]] },
    { at: 52000, flag: true, list: [['normal', 5, 2400], ['cone', 2, 3000]] },
  ],
  2: [
    { at: 13000, flag: false, list: [['normal', 3, 4000]] },
    { at: 31000, flag: false, list: [['normal', 3, 3000], ['cone', 2, 4000]] },
    { at: 53000, flag: false, list: [['cone', 3, 3500], ['bucket', 1, 5000]] },
    { at: 74000, flag: true, list: [['normal', 6, 1700], ['cone', 4, 2600], ['bucket', 2, 5000]] },
  ],
  3: [
    { at: 11000, flag: false, list: [['normal', 3, 3000], ['cone', 1, 2000]] },
    { at: 29000, flag: false, list: [['normal', 4, 2200], ['cone', 2, 3000], ['bucket', 1, 2000]] },
    { at: 49000, flag: false, list: [['normal', 5, 1800], ['cone', 3, 2600], ['bucket', 2, 4000]] },
    { at: 70000, flag: false, list: [['normal', 4, 1600], ['cone', 4, 2400], ['bucket', 3, 3600]] },
    { at: 92000, flag: true, list: [['normal', 8, 1300], ['cone', 5, 2000], ['bucket', 4, 3000]] },
  ],
};

export const DIFF_HP_SCALE = { 1: 1, 2: 1.12, 3: 1.25 };

export const ZOMBIE_SPEED_KEY = 'word-garden-zombie-speed';
export const DEFAULT_ZOMBIE_SPEED = 'normal';
export const ZOMBIE_SPEEDS = [
  { id: 'slow', name: '慢', icon: '🐢', scale: 1.35 },
  { id: 'normal', name: '正常', icon: '🚶', scale: 1 },
  { id: 'fast', name: '快', icon: '🐇', scale: 0.78 },
  { id: 'rush', name: '极速', icon: '🔥', scale: 0.6 },
];

export function zombieSpeed(id) {
  return ZOMBIE_SPEEDS.find((s) => s.id === id)
    || ZOMBIE_SPEEDS.find((s) => s.id === DEFAULT_ZOMBIE_SPEED);
}

export const SPELL = {
  sunPerWord: 10,
  comboBonusAt: 3,
  comboBonus: 5,
  energyPerWord: 25,
  boltDamage: 45,
  stormDamage: 260,
  wrongLock: 1400,
};

export function buildSpawns(diff, speed = 1) {
  const scale = typeof speed === 'number' ? speed : zombieSpeed(speed).scale;
  const waves = WAVES[diff] || WAVES[1];
  const spawns = [];
  waves.forEach((wave, wi) => {
    wave.list.forEach(([type, count, every]) => {
      for (let i = 0; i < count; i++) {
        spawns.push({
          at: Math.round((wave.at + i * every) * scale),
          type,
          wave: wi,
          flag: wave.flag && i === count - 1,
        });
      }
    });
  });
  spawns.sort((a, b) => a.at - b.at);
  return spawns;
}

export function totalZombies(diff, speed = 1) {
  return buildSpawns(diff, speed).length;
}

export function starFor(accuracy) {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.75) return 2;
  if (accuracy >= 0.6) return 1;
  return 0;
}

export const SAVE_KEY = 'word-garden-progress-v1';
