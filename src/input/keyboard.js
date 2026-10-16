// Điều khiển bằng bàn phím cho p1. Phát đúng các event giống như vision.
import { emit } from '../events.js';

const PUNCH_KEYS = {
  KeyJ: { hand: 'L', kind: 'jab' },
  KeyK: { hand: 'R', kind: 'jab' },
  KeyU: { hand: 'L', kind: 'hook' },
  KeyI: { hand: 'R', kind: 'hook' },
};

export function initKeyboard(who = 'p1') {
  const held = new Set();

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    held.add(e.code);
    const punch = PUNCH_KEYS[e.code];
    if (punch) emit('PUNCH', { who, ...punch, power: 0.8 });
    if (e.code === 'KeyL') emit('GUARD', { who, on: true });
    if (e.code === 'KeyA') emit('DODGE', { who, dir: 'L' });
    if (e.code === 'KeyD') emit('DODGE', { who, dir: 'R' });
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (e.code === 'KeyL') emit('GUARD', { who, on: false });
    if (e.code === 'KeyA' || e.code === 'KeyD') {
      const other = held.has('KeyA') ? 'L' : held.has('KeyD') ? 'R' : null;
      emit('DODGE', { who, dir: other });
    }
  });
}
