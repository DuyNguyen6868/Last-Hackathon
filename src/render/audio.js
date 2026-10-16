// Âm thanh tổng hợp bằng WebAudio, không cần file ngoài.
// Trình duyệt chỉ cho phát sau khi người dùng chạm/bấm phím lần đầu.

let ctx = null;
let master = null;
let noiseBuf = null;

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export { unlock as unlockAudio };

export function initAudio() {
  const handler = () => unlock();
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
  return () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
}

export function setVolume(v) {
  if (master) master.gain.value = v;
}

const ready = () => ctx && ctx.state === 'running';

function envelope(gain, t0, peak, dur) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function tone({ type = 'sine', f0, f1 = f0, dur, gain, at = 0 }) {
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  envelope(g, t0, gain, dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ filter = 'lowpass', f0, f1 = f0, q = 1, dur, gain, at = 0 }) {
  const t0 = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = filter;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t0);
  fl.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  const g = ctx.createGain();
  envelope(g, t0, gain, dur);
  s.connect(fl).connect(g).connect(master);
  s.start(t0);
  s.stop(t0 + dur + 0.05);
}

export const sfx = {
  whoosh() {
    if (!ready()) return;
    noise({ filter: 'bandpass', f0: 500, f1: 2400, q: 0.8, dur: 0.16, gain: 0.18 });
  },
  punch(power = 0.5) {
    if (!ready()) return;
    tone({ f0: 170, f1: 45, dur: 0.2, gain: 0.5 + power * 0.5 });
    noise({ filter: 'lowpass', f0: 1800, f1: 300, dur: 0.1, gain: 0.35 + power * 0.3 });
  },
  block() {
    if (!ready()) return;
    tone({ type: 'triangle', f0: 920, dur: 0.28, gain: 0.25 });
    tone({ type: 'triangle', f0: 1480, dur: 0.22, gain: 0.18 });
    noise({ filter: 'highpass', f0: 3000, dur: 0.06, gain: 0.25 });
  },
  bell(times = 1) {
    if (!ready()) return;
    for (let i = 0; i < times; i++) {
      const at = i * 0.5;
      tone({ f0: 880, dur: 1.3, gain: 0.3, at });
      tone({ f0: 1318, dur: 1.0, gain: 0.18, at });
      tone({ f0: 2217, dur: 0.7, gain: 0.1, at });
    }
  },
  ko() {
    if (!ready()) return;
    tone({ type: 'sawtooth', f0: 220, f1: 35, dur: 0.9, gain: 0.35 });
    tone({ f0: 90, f1: 30, dur: 0.6, gain: 0.8 });
    noise({ filter: 'lowpass', f0: 2500, f1: 200, dur: 0.5, gain: 0.5 });
  },
};
