// Đối thủ AI (p2): máy trạng thái IDLE → APPROACH → ATTACK / GUARD / DODGE → RECOVER.
// Chỉ giao tiếp qua event bus: nghe hành động của p1, phát PUNCH / GUARD / DODGE cho p2.
import { on, emit } from '../events.js';

const ME = 'p2';
const TICK_MS = 100;
const HIT_DELAY_MS = 250; // game tính trúng đòn sau 250ms, phản xạ phải nhanh hơn mức này

// Né sang hướng nào thì tránh được đòn từ tay nào của p1.
// TODO(Duy): khớp với dodgeAvoids() trong game; nếu ngược thì đổi L/R ở đây.
export const DODGE_AWAY = { L: 'R', R: 'L' };

export const DIFF = {
  // react: xác suất thủ/né khi p1 đấm · reactMs: độ trễ phản xạ · aggro: xác suất ra đòn mỗi nhịp
  // cooldownMs: nghỉ giữa 2 lần ra đòn · stunMs: khựng khi trúng đòn · smartDodge: né đúng hướng
  // combo: xác suất đánh jab-jab-hook · counter: xác suất phản đòn ngay sau khi thủ/né
  easy:   { react: 0.2,  reactMs: 210, aggro: 0.3, cooldownMs: 1500, stunMs: 350, smartDodge: false, combo: 0,    counter: 0 },
  normal: { react: 0.45, reactMs: 160, aggro: 0.4, cooldownMs: 1100, stunMs: 250, smartDodge: false, combo: 0.15, counter: 0.2 },
  hard:   { react: 0.7,  reactMs: 90,  aggro: 0.7, cooldownMs: 600,  stunMs: 120, smartDodge: true,  combo: 0.35, counter: 0.5 },
};

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.random() * (b - a);
const power = () => 0.5 + Math.random() * 0.5;

let cfg = DIFF.normal;
let diffName = 'normal';
let debug = false;
let active = false;
let started = false;

let state = 'IDLE';
let stateUntil = 0;
let stunUntil = 0;
let lastAttack = 0;
let queue = []; // các cú đấm combo đang chờ: { at, hand, kind }
let reactTimer = null;
let guarding = false;
let dodging = null;

const p1 = { guard: false, guardSince: 0, dodge: null, lastPunch: 0 };

const log = (...a) => debug && console.log('[AI]', ...a);

function enter(next, ms = 0) {
  if (next !== state) log(state, '→', next);
  state = next;
  stateUntil = Date.now() + ms;
}

function setGuard(onOff) {
  if (guarding === onOff) return;
  guarding = onOff;
  emit('GUARD', { who: ME, on: onOff });
}

function setDodge(dir) {
  if (dodging === dir) return;
  dodging = dir;
  emit('DODGE', { who: ME, dir });
}

function releaseDefense() {
  setGuard(false);
  setDodge(null);
}

function punch(hand, kind) {
  emit('PUNCH', { who: ME, hand, kind, power: power() });
  lastAttack = Date.now();
}

const p1GuardingLong = () => p1.guard && Date.now() - p1.guardSince > 1000;

function startAttack() {
  releaseDefense();
  const now = Date.now();
  if (Math.random() < cfg.combo) {
    // jab - jab - hook
    const lead = rand(['L', 'R']);
    const rear = lead === 'L' ? 'R' : 'L';
    queue = [
      { at: now, hand: lead, kind: 'jab' },
      { at: now + 280, hand: rear, kind: 'jab' },
      { at: now + 600, hand: lead, kind: 'hook' },
    ];
  } else {
    const kind = p1GuardingLong() ? (Math.random() < 0.8 ? 'hook' : 'jab') : Math.random() < 0.2 ? 'hook' : 'jab';
    queue = [{ at: now, hand: rand(['L', 'R']), kind }];
  }
  enter('ATTACK');
}

function defend(p1Hand) {
  queue = [];
  if (Math.random() < 0.5) {
    setDodge(null);
    setGuard(true);
    enter('GUARD', between(400, 700));
  } else {
    setGuard(false);
    const dir = cfg.smartDodge && p1Hand ? DODGE_AWAY[p1Hand] : rand(['L', 'R']);
    setDodge(dir);
    enter('DODGE', between(350, 500));
  }
}

function tick() {
  if (!active) return;
  const now = Date.now();
  const done = now >= stateUntil;

  switch (state) {
    case 'IDLE':
      enter('APPROACH', between(200, 600));
      break;

    case 'APPROACH': {
      if (!done || now < stunUntil) break; // đang khựng vì trúng đòn thì chưa ra đòn
      const ready = now - lastAttack >= cfg.cooldownMs;
      // p1 thủ lâu thì AI hăng hơn để phá thủ bằng hook; p1 vừa đấm xong (tay đang duỗi) là lúc phản đòn
      const opening = now - p1.lastPunch < 500;
      const aggro = Math.min(1, cfg.aggro + (p1GuardingLong() ? 0.25 : 0) + (opening ? 0.2 : 0));
      if (ready && Math.random() < aggro) startAttack();
      else if (Math.random() < 0.12) defend(null); // thỉnh thoảng thủ chủ động
      else enter('APPROACH', between(150, 350)); // chưa ra đòn thì nhử thêm một nhịp
      break;
    }

    case 'ATTACK':
      while (queue.length && queue[0].at <= now) {
        const p = queue.shift();
        punch(p.hand, p.kind);
      }
      if (!queue.length) enter('RECOVER', between(300, 500));
      break;

    case 'GUARD':
    case 'DODGE':
      if (done) {
        releaseDefense();
        if (Math.random() < cfg.counter) startAttack(); // phản đòn ngay sau khi thủ/né
        else enter('RECOVER', 150);
      }
      break;

    case 'RECOVER':
      if (done) enter('IDLE');
      break;
  }
}

function onP1Punch({ hand }) {
  p1.lastPunch = Date.now();
  if (!active || reactTimer) return;
  if (state === 'GUARD' || state === 'DODGE') return;
  if (Math.random() >= cfg.react) return;
  const delay = Math.min(cfg.reactMs, HIT_DELAY_MS - 30);
  reactTimer = setTimeout(() => {
    reactTimer = null;
    if (active) defend(hand);
  }, delay);
}

function reset() {
  clearTimeout(reactTimer);
  reactTimer = null;
  queue = [];
  stunUntil = 0;
  releaseDefense();
  enter('IDLE');
}

export function setDifficulty(name) {
  if (!DIFF[name]) return;
  diffName = name;
  cfg = DIFF[name];
  log('difficulty', name);
}

export const getDifficulty = () => diffName;
export const getState = () => state;

export function startOpponent({ difficulty = 'normal', debug: dbg = false } = {}) {
  setDifficulty(difficulty);
  debug = dbg;
  if (started) return;
  started = true;

  on('PUNCH', (e) => e.who === 'p1' && onP1Punch(e));
  on('GUARD', (e) => {
    if (e.who !== 'p1') return;
    if (e.on && !p1.guard) p1.guardSince = Date.now();
    p1.guard = e.on;
  });
  on('DODGE', (e) => e.who === 'p1' && (p1.dodge = e.dir));
  on('HIT', ({ target, blocked }) => {
    // bị trúng đòn thì khựng lại một chút, bỏ combo đang dở
    if (target === ME && !blocked && active) {
      queue = [];
      stunUntil = Date.now() + cfg.stunMs;
      if (state === 'ATTACK') enter('RECOVER', 0);
    }
  });
  on('ROUND', ({ state: s }) => {
    if (s === 'start') {
      active = true;
      reset();
      lastAttack = Date.now(); // cho người chơi một nhịp trước cú đầu tiên
    } else if (s === 'end' || s === 'ko') {
      active = false;
      reset();
    }
  });

  setInterval(tick, TICK_MS);
}
