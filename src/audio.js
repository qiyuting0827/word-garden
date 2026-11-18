// 原创合成音效：不依赖任何外部音频文件
// 用 Web Audio 现场合成，音量小、无版权素材
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function tone(ctx, out, {
  freq = 440, to = freq, dur = 0.12, type = 'sine',
  vol = 0.2, attack = 0.006, delay = 0, detune = 0,
} = {}) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  if (detune) osc.detune.value = detune;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

let noiseBuffer = null;

function noise(ctx, out, {
  dur = 0.12, vol = 0.2, type = 'lowpass', cutoff = 1200,
  delay = 0, q = 0.8,
} = {}) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(cutoff, t0);
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

const arp = (notes, step, opts = {}) => (ctx, out, vol, rate) => {
  notes.forEach((freq, i) => tone(ctx, out, {
    freq: freq * rate, dur: opts.dur || step * 1.15, type: opts.type || 'triangle',
    vol: vol * (opts.vol || 0.65), delay: i * step, attack: 0.005,
  }));
};

const SOUNDS = {
  click: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 720 * rate, to: 560 * rate, dur: 0.05, type: 'square', vol: vol * 0.4 });
  },
  plant: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 260 * rate, to: 120 * rate, dur: 0.16, type: 'sine', vol: vol * 0.75 });
    noise(ctx, out, { dur: 0.09, vol: vol * 0.3, cutoff: 420 * rate });
  },
  sun: arp([880, 1174, 1568], 0.055, { type: 'triangle', vol: 0.55 }),
  shoot: (ctx, out, vol, rate) => {
    noise(ctx, out, { dur: 0.055, vol: vol * 0.35, type: 'highpass', cutoff: 700 * rate });
    tone(ctx, out, { freq: 680 * rate, to: 260 * rate, dur: 0.07, type: 'square', vol: vol * 0.3 });
  },
  hit: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 170 * rate, to: 90 * rate, dur: 0.09, type: 'triangle', vol: vol * 0.65 });
    noise(ctx, out, { dur: 0.05, vol: vol * 0.3, cutoff: 1000 * rate });
  },
  chomp: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 100 * rate, to: 55 * rate, dur: 0.1, type: 'sawtooth', vol: vol * 0.55 });
    noise(ctx, out, { dur: 0.07, vol: vol * 0.35, cutoff: 380 * rate });
  },
  explode: (ctx, out, vol, rate) => {
    noise(ctx, out, { dur: 0.55, vol: vol * 0.9, cutoff: 700 * rate, q: 0.6 });
    tone(ctx, out, { freq: 90 * rate, to: 32 * rate, dur: 0.55, type: 'sine', vol: vol * 0.8 });
  },
  cherry: (ctx, out, vol, rate) => {
    noise(ctx, out, { dur: 0.4, vol: vol * 0.7, type: 'bandpass', cutoff: 320 * rate, q: 0.7 });
    tone(ctx, out, { freq: 150 * rate, to: 40 * rate, dur: 0.42, type: 'sawtooth', vol: vol * 0.5 });
  },
  siren: (ctx, out, vol, rate) => {
    [0, 0.16, 0.32, 0.48].forEach((delay, i) => tone(ctx, out, {
      freq: (i % 2 ? 920 : 600) * rate, dur: 0.14, type: 'sawtooth', vol: vol * 0.25, delay,
    }));
  },
  huge: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 82 * rate, to: 60 * rate, dur: 0.8, type: 'sawtooth', vol: vol * 0.5, attack: 0.05 });
    tone(ctx, out, { freq: 123 * rate, to: 90 * rate, dur: 0.75, type: 'square', vol: vol * 0.22, delay: 0.05 });
  },
  ready: arp([523, 659, 784, 1047], 0.1, { dur: 0.18, type: 'triangle', vol: 0.8 }),
  groan: (ctx, out, vol, rate) => {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(78 * rate, t0);
    osc.frequency.linearRampToValueAtTime(55 * rate, t0 + 0.5);
    lfo.frequency.value = 6;
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.45), t0 + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(gain).connect(out);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + 0.58); lfo.stop(t0 + 0.58);
  },
  freeze: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 1500 * rate, to: 420 * rate, dur: 0.25, type: 'sine', vol: vol * 0.35 });
    noise(ctx, out, { dur: 0.2, vol: vol * 0.2, type: 'highpass', cutoff: 2400 * rate });
  },
  mower: (ctx, out, vol, rate) => {
    tone(ctx, out, { freq: 72 * rate, to: 96 * rate, dur: 0.8, type: 'sawtooth', vol: vol * 0.45 });
    noise(ctx, out, { dur: 0.8, vol: vol * 0.4, cutoff: 500 * rate });
  },
  lose: arp([392, 330, 262, 196], 0.19, { dur: 0.3, type: 'triangle', vol: 0.85 }),
  win: arp([523, 659, 784, 1047], 0.14, { dur: 0.26, type: 'triangle', vol: 0.9 }),
  evillaugh: (ctx, out, vol, rate) => {
    [0, 0.14, 0.28, 0.42].forEach((delay, i) => tone(ctx, out, {
      freq: (200 + i * 30) * rate, to: (170 + i * 30) * rate,
      dur: 0.1, type: 'square', vol: vol * 0.3, delay,
    }));
  },
};

class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('word-garden-muted') === '1';
    this.volume = 0.6;
    this.ctx = null;
    this.master = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  preload() {
    // 首次用户手势时创建 AudioContext；无需加载文件
    this.ensure();
  }

  play(key, { volume = this.volume, rate = 1 } = {}) {
    if (this.muted) return;
    const fn = SOUNDS[key];
    if (!fn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      fn(ctx, this.master, clamp(volume, 0, 1), clamp(rate, 0.5, 2));
    } catch {
      /* 忽略音频调度异常 */
    }
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('word-garden-muted', muted ? '1' : '0');
    if (!muted) {
      this.ensure();
      this.play('click', { volume: 0.25 });
    }
  }
}

export const audio = new AudioManager();
