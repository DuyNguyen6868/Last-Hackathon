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
  const moveDirections = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
  };
  const moveKeys = new Set(Object.keys(moveDirections));
  const dodgeKeys = new Set(['KeyQ', 'KeyE']);

  function updateMovement() {
    const x = [...held].reduce((sum, key) => sum + (moveDirections[key]?.[0] ?? 0), 0);
    const z = [...held].reduce((sum, key) => sum + (moveDirections[key]?.[1] ?? 0), 0);
    const length = Math.hypot(x, z) || 1;
    emit('MOVE', { who, x: x / length, z: z / length, source: 'keyboard', active: [...held].some((key) => moveKeys.has(key)) });
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (moveKeys.has(e.code)) e.preventDefault();
    held.add(e.code);
    if (moveKeys.has(e.code)) updateMovement();
    const punch = PUNCH_KEYS[e.code];
    if (punch) emit('PUNCH', { who, ...punch, power: 0.8 });
    if (e.code === 'KeyL') emit('GUARD', { who, on: true });
    if (e.code === 'KeyQ') emit('DODGE', { who, dir: 'L' });
    if (e.code === 'KeyE') emit('DODGE', { who, dir: 'R' });
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (moveKeys.has(e.code)) updateMovement();
    if (e.code === 'KeyL') emit('GUARD', { who, on: false });
    if (dodgeKeys.has(e.code)) {
      const other = held.has('KeyQ') ? 'L' : held.has('KeyE') ? 'R' : null;
      emit('DODGE', { who, dir: other });
    }
  });
}
