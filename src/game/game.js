// Logic game (Duy): máu, hiệp, luật trúng đòn, KO.
import { on, emit } from '../events.js';
import { CONFIG } from '../config.js';

export const other = (who) => (who === 'p1' ? 'p2' : 'p1');

const newFighter = () => ({
  hp: CONFIG.maxHP,
  guard: false,
  guardSince: 0,
  dodge: null,
  dodgeSince: 0,
  lastPunch: -Infinity,
  stunnedUntil: 0,
  seq: [], // chuỗi đòn gần nhất để nhận combo: { kind, hand, t, result }
  counterUntil: 0, // còn trong cửa sổ phản đòn
  stats: { thrown: 0, landed: 0, blocked: 0, missed: 0, combos: 0, counters: 0 },
});

// Hệ số sát thương theo người đánh. AI đặt hệ số của p2 theo độ khó (xem ai/opponent.js)
const damageScale = { p1: 1, p2: 1 };
export function setDamageScale(who, scale) {
  damageScale[who] = scale;
}

// Tìm combo dài nhất khớp với đuôi chuỗi đòn: đúng loại đòn, đổi tay luân phiên, không đòn nào bị né
function matchCombo(seq) {
  let best = null;
  for (const c of CONFIG.combos) {
    const n = c.seq.length;
    if (seq.length < n || (best && n <= best.seq.length)) continue;
    const tail = seq.slice(-n);
    const ok = tail.every(
      (e, i) => e.kind === c.seq[i] && e.result !== 'missed' && (i === 0 || tail[i - 1].hand !== e.hand),
    );
    if (ok) best = c;
  }
  return best;
}

// Combo này còn nối dài thành combo khác được không (ONE-TWO → TRIPLE THREAT → STEEL STORM)
const extendable = (combo) =>
  CONFIG.combos.some((c) => c.seq.length > combo.seq.length && combo.seq.every((k, i) => c.seq[i] === k));

// phase: 'menu' | 'countdown' | 'fight' | 'between' | 'over'
export const game = {
  phase: 'menu',
  round: 0,
  wins: { p1: 0, p2: 0 },
  timeLeft: CONFIG.roundSeconds,
  f: { p1: newFighter(), p2: newFighter() },
};

const timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const hpPayload = () => ({ p1: game.f.p1.hp, p2: game.f.p2.hp });

export function startMatch() {
  timers.splice(0).forEach(clearTimeout);
  game.round = 0;
  game.wins = { p1: 0, p2: 0 };
  nextRound();
}

function nextRound() {
  game.round++;
  game.f = { p1: newFighter(), p2: newFighter() };
  game.timeLeft = CONFIG.roundSeconds;
  game.phase = 'countdown';
  emit('ANIM', { who: 'p1', name: 'reset' });
  emit('ANIM', { who: 'p2', name: 'reset' });
  emit('HP', hpPayload());
  emit('TIMER', { seconds: CONFIG.roundSeconds });
  emit('ROUND', { round: game.round, state: 'countdown', wins: game.wins });
  later(() => {
    game.phase = 'fight';
    emit('ROUND', { round: game.round, state: 'fight', wins: game.wins });
  }, CONFIG.countdownMs);
}

export function updateGame(dt) {
  if (game.phase !== 'fight') return;
  const before = Math.ceil(game.timeLeft);
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  const after = Math.ceil(game.timeLeft);
  if (after !== before) emit('TIMER', { seconds: after });
  if (game.timeLeft === 0) endRound(null);
}

function roundStats() {
  const s = (who) => ({ hp: Math.round(game.f[who].hp), ...game.f[who].stats });
  return { round: game.round, p1: s('p1'), p2: s('p2') };
}

function endRound(koWinner) {
  game.phase = 'between';
  const { p1, p2 } = game.f;
  const winner = koWinner ?? (p1.hp === p2.hp ? null : p1.hp > p2.hp ? 'p1' : 'p2');
  if (winner) game.wins[winner]++;
  const stats = roundStats();
  if (koWinner) emit('ANIM', { who: other(koWinner), name: 'ko' });
  emit('ROUND', { round: game.round, state: koWinner ? 'ko' : 'end', winner, stats, wins: game.wins });

  const majority = Math.floor(CONFIG.rounds / 2) + 1;
  const matchOver =
    koWinner || game.round >= CONFIG.rounds || game.wins.p1 >= majority || game.wins.p2 >= majority;

  if (matchOver) {
    const champ =
      koWinner ?? (game.wins.p1 === game.wins.p2 ? null : game.wins.p1 > game.wins.p2 ? 'p1' : 'p2');
    later(() => {
      game.phase = 'over';
      emit('ROUND', { round: game.round, state: 'over', winner: champ, stats, wins: game.wins });
    }, CONFIG.matchEndDelayMs);
  } else {
    later(nextRound, CONFIG.betweenRoundsMs);
  }
}

function resolveHit(who, entry, power) {
  if (game.phase !== 'fight') return;
  const me = game.f[who];
  const t = other(who);
  const target = game.f[t];
  const now = performance.now();
  const { kind } = entry;

  // Bị né: đứt chuỗi combo, người né được quyền phản đòn
  if (target.dodge && now - target.dodgeSince < CONFIG.dodgeWindowMs) {
    entry.result = 'missed';
    me.seq = [];
    me.stats.missed++;
    target.counterUntil = now + CONFIG.counterWindowMs;
    emit('MISS', { attacker: who, target: t });
    return;
  }

  const blocked = target.guard;
  entry.result = blocked ? 'blocked' : 'landed';
  me.stats[blocked ? 'blocked' : 'landed']++;

  let bonus = 0;
  let multiplier = 1;
  let stunMs = CONFIG.hitStunMs;
  const names = [];
  if (blocked) {
    target.counterUntil = now + CONFIG.counterWindowMs; // đỡ được cũng có quyền phản đòn
  } else {
    if (now < me.counterUntil) {
      multiplier = CONFIG.counterMultiplier;
      me.counterUntil = 0;
      me.stats.counters++;
      names.push('COUNTER');
    }
    const combo = matchCombo(me.seq);
    if (combo) {
      bonus = combo.bonus;
      stunMs = combo.stunMs ?? stunMs;
      me.stats.combos++;
      names.push(combo.name);
      if (!extendable(combo)) me.seq = [];
    }
  }

  const raw =
    (CONFIG.damage[kind] * (0.5 + 0.5 * power) + bonus) *
    multiplier *
    damageScale[who] *
    (blocked ? CONFIG.guardMultiplier : 1);
  const damage = Math.round(raw * 10) / 10;
  target.hp = Math.max(0, target.hp - damage);
  if (!blocked) {
    target.stunnedUntil = now + stunMs;
    emit('ANIM', { who: t, name: 'hit' });
  }
  emit('HIT', { attacker: who, target: t, damage, blocked, kind });
  if (names.length) emit('COMBO', { who, target: t, name: names.join(' + '), damage });
  emit('HP', hpPayload());
  if (target.hp <= 0) endRound(who);
}

on('PUNCH', ({ who, hand, kind, power = 0.7 }) => {
  const me = game.f[who];
  const now = performance.now();
  if (game.phase !== 'fight') return;
  if (me.guard || now < me.stunnedUntil || now - me.lastPunch < CONFIG.punchCooldownMs) return;
  me.lastPunch = now;
  me.stats.thrown++;

  // Ghi vào chuỗi combo. Nghỉ quá lâu giữa hai đòn thì bắt đầu chuỗi mới
  const last = me.seq[me.seq.length - 1];
  if (last && now - last.t > CONFIG.comboGapMs) me.seq = [];
  const entry = { kind, hand, t: now, result: null };
  me.seq.push(entry);
  if (me.seq.length > 4) me.seq.shift();

  emit('ANIM', { who, name: `${kind}_${hand}` });
  later(() => resolveHit(who, entry, power), CONFIG.hitDelayMs);
});

on('GUARD', ({ who, on: isOn }) => {
  const me = game.f[who];
  if (me.guard === isOn) return;
  me.guard = isOn;
  me.guardSince = performance.now();
  emit('ANIM', { who, name: isOn ? 'guard' : 'idle' });
});

on('DODGE', ({ who, dir }) => {
  const me = game.f[who];
  if (me.dodge === dir) return;
  me.dodge = dir;
  me.dodgeSince = performance.now();
  emit('ANIM', { who, name: dir ? `dodge_${dir}` : 'idle' });
});
