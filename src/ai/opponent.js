// Đối thủ AI (Tiến Anh): máy trạng thái đơn giản điều khiển p2 qua event bus.
// Mỗi đòn của AI đều có động tác LẤY ĐÀ (event TELEGRAPH) trước khi ra đòn để người chơi kịp né/đỡ:
// thời gian phản ứng của người chơi = windupMs + CONFIG.hitDelayMs.
import { emit } from '../events.js';
import { CONFIG } from '../config.js';
import { game, setDamageScale } from '../game/game.js';

export const DIFFICULTY = {
  // react: xác suất đỡ/né khi bị đấm · aggro: xác suất ra đòn mỗi tick · combo: xác suất đánh combo
  // windupMs: thời gian lấy đà · damage: hệ số sát thương của AI · maxCombo: độ dài combo tối đa
  easy: { react: 0.2, aggro: 0.05, combo: 0.1, windupMs: 750, damage: 0.5, maxCombo: 2, tickMs: 140 },
  normal: { react: 0.4, aggro: 0.08, combo: 0.25, windupMs: 550, damage: 0.7, maxCombo: 3, tickMs: 110 },
  hard: { react: 0.6, aggro: 0.11, combo: 0.4, windupMs: 420, damage: 0.9, maxCombo: 4, tickMs: 90 },
};

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FOLLOW_UP_GAP = 120; // nghỉ giữa đòn trước và lúc lấy đà cho đòn sau trong combo

export function createOpponent(who = 'p2', foe = 'p1') {
  let cfg = DIFFICULTY.normal;
  let acc = 0;
  let busyUntil = 0; // đang đỡ/né/ra đòn thì chưa quyết định tiếp
  let seenPunch = 0;
  let chainBroken = false; // combo bị ngắt (AI bị đánh trúng khi đang lấy đà)
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

  // Một đòn: lấy đà windup ms rồi mới đấm. Bị đánh trúng trong lúc lấy đà thì huỷ đòn và cả combo
  function strike(hand, kind, windup, delay) {
    later(() => {
      if (chainBroken || game.phase !== 'fight') return;
      emit('TELEGRAPH', { who, hand, kind, ms: windup });
      later(() => {
        if (chainBroken || game.phase !== 'fight') return;
        if (performance.now() < game.f[who].stunnedUntil) {
          chainBroken = true;
          emit('ANIM', { who, name: 'idle' });
          return;
        }
        emit('PUNCH', { who, hand, kind, power: 0.5 + Math.random() * 0.5 });
      }, windup);
    }, delay);
  }

  function attack(now, foeState) {
    if (game.f[who].guard) emit('GUARD', { who, on: false });
    chainBroken = false;

    // Chọn chuỗi đòn: combo trong CONFIG.combos hoặc một đòn lẻ
    let moves;
    const combos = CONFIG.combos.filter((c) => c.seq.length <= cfg.maxCombo);
    if (combos.length && Math.random() < cfg.combo) {
      moves = rand(combos).seq;
    } else {
      const guardingLong = foeState.guard && now - foeState.guardSince > 700;
      moves = [guardingLong || Math.random() < 0.25 ? 'hook' : 'jab'];
    }

    // Đòn đầu lấy đà đủ lâu, các đòn sau nhanh hơn nhưng vẫn đủ để qua punchCooldownMs
    const followWindup = Math.max(cfg.windupMs * 0.55, CONFIG.punchCooldownMs + 40 - FOLLOW_UP_GAP);
    let hand = rand(['L', 'R']);
    let t = 0;
    moves.forEach((kind, i) => {
      const windup = i === 0 ? cfg.windupMs : followWindup;
      strike(hand, kind, windup, t);
      t += windup + FOLLOW_UP_GAP;
      hand = hand === 'L' ? 'R' : 'L';
    });
    busyUntil = now + t + 250;
  }

  const api = {
    setLevel(level) {
      cfg = DIFFICULTY[level] ?? DIFFICULTY.normal;
      setDamageScale(who, cfg.damage);
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
  api.setLevel('normal');
  return api;
}
