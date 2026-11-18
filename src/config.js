// 游戏数值与关卡配置（坐标均为草坪局部坐标：1400 x 600）
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

export const PLANTS = {
  sunflower: {
    name: '向日葵', cost: 50, hp: 300, cooldown: 5000,
    img: './assets/original/plants/sunflower.svg',
    card: './assets/original/plants/sunflower.svg',
    w: 94, h: 96, anchorY: 30,
    produce: 9000, sunValue: 25,
  },
  peashooter: {
    name: '豌豆射手', cost: 100, hp: 300, cooldown: 5000,
    img: './assets/original/plants/peashooter.svg',
    card: './assets/original/plants/peashooter.svg',
    w: 94, h: 94, anchorY: 26,
    fire: 1450, damage: 20, projectile: 'pea',
  },
  wallnut: {
    name: '坚果墙', cost: 50, hp: 1600, cooldown: 12000,
    img: './assets/original/plants/wallnut.svg',
    card: './assets/original/plants/wallnut.svg',
    w: 82, h: 94, anchorY: 24,
    imgs: [
      './assets/original/plants/wallnut.svg',
      './assets/original/plants/wallnut_cracked1.svg',
      './assets/original/plants/wallnut_cracked2.svg',
    ],
  },
  snowpea: {
    name: '寒冰射手', cost: 175, hp: 300, cooldown: 8000,
    img: './assets/original/plants/snowpea.svg',
    card: './assets/original/plants/snowpea.svg',
    w: 94, h: 94, anchorY: 26,
    fire: 1600, damage: 20, projectile: 'ice', slow: 3000,
  },
  cherrybomb: {
    name: '樱桃炸弹', cost: 150, hp: 9999, cooldown: 18000,
    img: './assets/original/plants/cherrybomb.svg',
    card: './assets/original/plants/cherrybomb.svg',
    w: 86, h: 86, anchorY: 22,
    fuse: 900, damage: 900, radius: 200,
  },
};

export const ZOMBIES = {
  normal: {
    name: '普通僵尸', hp: 100, speed: 17, dps: 32,
    img: './assets/original/zombies/zombie.svg',
    w: 124, h: 118,
  },
  cone: {
    name: '路障僵尸', hp: 220, speed: 16, dps: 32,
    img: './assets/original/zombies/cone.svg',
    w: 124, h: 122,
  },
  bucket: {
    name: '铁桶僵尸', hp: 380, speed: 14, dps: 34,
    img: './assets/original/zombies/bucket.svg',
    w: 126, h: 124,
  },
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

export const SPELL = {
  sunPerWord: 10,
  comboBonusAt: 3,
  comboBonus: 5,
  energyPerWord: 25,
  boltDamage: 45,
  stormDamage: 260,
  wrongLock: 1400,
};

export function buildSpawns(diff) {
  const waves = WAVES[diff] || WAVES[1];
  const spawns = [];
  waves.forEach((wave, wi) => {
    wave.list.forEach(([type, count, every]) => {
      for (let i = 0; i < count; i++) {
        spawns.push({ at: wave.at + i * every, type, wave: wi, flag: wave.flag && i === count - 1 });
      }
    });
  });
  spawns.sort((a, b) => a.at - b.at);
  return spawns;
}

export function totalZombies(diff) {
  return buildSpawns(diff).length;
}

export function starFor(accuracy) {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.75) return 2;
  if (accuracy >= 0.6) return 1;
  return 0;
}

export const SAVE_KEY = 'word-garden-progress-v1';
