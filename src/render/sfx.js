// Âm thanh tổng hợp bằng WebAudio, không cần file asset (Thành có thể thay bằng file thật).
import { on } from '../events.js';

let ctx;

export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
}

function noiseBurst({ duration = 0.12, freq = 800, gain = 0.6, q = 1 }) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start();
}

function tone({ freq = 440, to = freq, duration = 0.2, gain = 0.3, type = 'sine' }) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

const sfx = {
  punch: () => { noiseBurst({ freq: 600, gain: 0.9 }); tone({ freq: 160, to: 50, duration: 0.15, gain: 0.5 }); },
  block: () => { noiseBurst({ freq: 3000, gain: 0.4, duration: 0.08 }); tone({ freq: 900, to: 600, duration: 0.08, gain: 0.15, type: 'square' }); },
  whoosh: () => noiseBurst({ freq: 1800, gain: 0.25, duration: 0.18, q: 0.5 }),
  bell: () => { tone({ freq: 880, duration: 1.2, gain: 0.25 }); tone({ freq: 1320, duration: 0.9, gain: 0.12 }); },
  ko: () => tone({ freq: 300, to: 60, duration: 1.0, gain: 0.4, type: 'sawtooth' }),
};

export function initSfx() {
  on('HIT', ({ blocked }) => (blocked ? sfx.block() : sfx.punch()));
  on('MISS', () => sfx.whoosh());
  on('ROUND', ({ state }) => {
    if (state === 'fight' || state === 'end') sfx.bell();
    if (state === 'ko') sfx.ko();
  });
}
