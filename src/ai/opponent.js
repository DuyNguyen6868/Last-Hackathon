// Đối thủ AI (Tiến Anh): máy trạng thái đơn giản điều khiển p2 qua event bus.
import { emit } from '../events.js';
import { game } from '../game/game.js';

export const DIFFICULTY = {
  easy: { react: 0.2, aggro: 0.06, combo: 0.0, tickMs: 140 },
  normal: { react: 0.45, aggro: 0.11, combo: 0.15, tickMs: 110 },
  hard: { react: 0.7, aggro: 0.17, combo: 0.35, tickMs: 90 },
};

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createOpponent(who = 'p2', foe = 'p1') {
  let cfg = DIFFICULTY.normal;
  let acc = 0;
  let busyUntil = 0; // đang đỡ/né/ra đòn thì chưa quyết định tiếp
  let seenPunch = 0;
  const timeouts = [];
  const later = (fn, ms) => timeouts.push(setTimeout(fn, ms));

  function defend(now) {
    if (Math.random() < 0.55) {
      emit('GUARD', { who, on: true });
      later(() => emit('GUARD', { who, on: false }), 450 + Math.random() * 300);
      busyUntil = now + 600;
    } else {
      const dir = rand(['L', 'R']);
      emit('DODGE', { who, dir });
      later(() => emit('DODGE', { who, dir: null }), 420);
      busyUntil = now + 550;
    }
  }

  function attack(now, foeState) {
    const me = game.f[who];
    if (me.guard) emit('GUARD', { who, on: false });
    const guardingLong = foeState.guard && now - foeState.guardSince > 700;
    const kind = guardingLong || Math.random() < 0.25 ? 'hook' : 'jab';
    emit('PUNCH', { who, hand: rand(['L', 'R']), kind, power: 0.5 + Math.random() * 0.5 });
    busyUntil = now + 380;
    if (Math.random() < cfg.combo) {
      later(() => emit('PUNCH', { who, hand: rand(['L', 'R']), kind: 'jab', power: 0.6 }), 400);
      busyUntil = now + 800;
    }
  }

  return {
    setLevel(level) {
      cfg = DIFFICULTY[level] ?? DIFFICULTY.normal;
    },

    update(dt, now) {
      if (game.phase !== 'fight') {
        timeouts.splice(0).forEach(clearTimeout);
        busyUntil = 0;
        return;
      }
      acc += dt * 1000;
      if (acc < cfg.tickMs) return;
      acc = 0;

      const foeState = game.f[foe];
      const me = game.f[who];

      // Phản ứng với cú đấm mới của đối thủ (phải kịp trước hitDelayMs)
      if (foeState.lastPunch > seenPunch) {
        seenPunch = foeState.lastPunch;
        if (now >= busyUntil && Math.random() < cfg.react) return defend(now);
      }
      if (now < busyUntil || now < me.stunnedUntil) return;

      // Máu thấp thì thủ nhiều hơn
      const lowHp = me.hp < 30;
      if (lowHp && Math.random() < 0.08) return defend(now);
      if (Math.random() < cfg.aggro * (lowHp ? 0.7 : 1)) attack(now, foeState);
    },
  };
}
