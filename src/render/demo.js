// Trang demo để Thành test phần render độc lập, không cần game/vision/AI thật.
// Dùng bus riêng và một "game giả" rất nhỏ để phát đúng các event trong contract.
import { initRender } from './index.js';

const handlers = {};
const bus = {
  on: (type, fn) => (handlers[type] ??= []).push(fn),
  emit: (type, payload = {}) => (handlers[type] || []).forEach((fn) => fn(payload)),
};
const { emit } = bus;

initRender({ bus });

// --- Game giả ---
const hp = { p1: 100, p2: 100 };
const guard = { p1: false, p2: false };
const other = (w) => (w === 'p1' ? 'p2' : 'p1');
const hpEl = document.getElementById('hp');
const showHp = () => (hpEl.textContent = `HP  p1: ${hp.p1.toFixed(0)}   p2: ${hp.p2.toFixed(0)}`);
showHp();

function hit(target, damage, blocked) {
  emit('HIT', { target, damage, blocked });
  if (!blocked) emit('ANIM', { who: target, name: 'hit' });
  hp[target] = Math.max(0, hp[target] - damage * (blocked ? 0.2 : 1));
  showHp();
  emit('HP', { ...hp });
  if (hp[target] === 0) ko(target);
}

function ko(target) {
  emit('ANIM', { who: target, name: 'ko' });
  emit('ROUND', { round: 1, state: 'ko', winner: other(target) });
}

bus.on('PUNCH', ({ who, hand, kind, power }) => {
  emit('ANIM', { who, name: `${kind}_${hand}` });
  setTimeout(() => {
    const t = other(who);
    const base = kind === 'hook' ? 10 : 5;
    hit(t, base * (0.5 + power * 0.5), guard[t]);
  }, 250);
});

bus.on('GUARD', ({ who, on }) => {
  guard[who] = on;
  emit('ANIM', { who, name: on ? 'guard' : 'idle' });
});

bus.on('DODGE', ({ who, dir }) => {
  emit('ANIM', { who, name: dir ? `dodge_${dir}` : guard[who] ? 'guard' : 'idle' });
});

function newRound() {
  hp.p1 = hp.p2 = 100;
  guard.p1 = guard.p2 = false;
  showHp();
  emit('ROUND', { round: 1, state: 'start' });
}

// --- Bàn phím (p1) ---
const punch = (hand, kind) => emit('PUNCH', { who: 'p1', hand, kind, power: 0.8 });
const keys = {
  j: () => punch('L', 'jab'),
  k: () => punch('R', 'jab'),
  u: () => punch('L', 'hook'),
  i: () => punch('R', 'hook'),
  a: () => emit('DODGE', { who: 'p1', dir: 'L' }),
  d: () => emit('DODGE', { who: 'p1', dir: 'R' }),
  1: () => hit('p2', 8, false),
  2: () => hit('p1', 8, false),
  3: () => hit('p2', 8, true),
  o: () => ko('p2'),
  p: () => ko('p1'),
  r: newRound,
  t: () => (aiOn = !aiOn),
};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'l') return emit('GUARD', { who: 'p1', on: true });
  keys[k]?.();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'l') emit('GUARD', { who: 'p1', on: false });
  if (k === 'a' || k === 'd') emit('DODGE', { who: 'p1', dir: null });
});

// --- AI p2 giả: thỉnh thoảng đấm ---
let aiOn = false;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
setInterval(() => {
  if (!aiOn || hp.p1 === 0 || hp.p2 === 0) return;
  emit('PUNCH', { who: 'p2', hand: pick(['L', 'R']), kind: pick(['jab', 'jab', 'hook']), power: 0.4 + Math.random() * 0.6 });
}, 1400);

// --- Kịch bản qua URL để chụp ảnh kiểm tra: ?play=ANIM.p1.jab_L@800,HIT.p2.8@900 ---
const play = new URLSearchParams(location.search).get('play');
if (play) {
  for (const item of play.split(',')) {
    const [spec, ms] = item.split('@');
    const [type, who, arg] = spec.split('.');
    setTimeout(() => {
      if (type === 'ANIM') emit('ANIM', { who, name: arg });
      else if (type === 'HIT') emit('HIT', { target: who, damage: Number(arg) || 8, blocked: false });
      else if (type === 'ROUND') emit('ROUND', { round: 1, state: who });
    }, Number(ms) || 0);
  }
}
