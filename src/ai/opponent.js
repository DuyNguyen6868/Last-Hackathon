// Đối thủ AI (p2): máy trạng thái TAUNT (đầu hiệp) → IDLE → APPROACH → ATTACK / GUARD / DODGE → RECOVER,
// và CELEBRATE khi trận kết thúc có người thắng.
// Chỉ giao tiếp qua event bus: nghe hành động của p1, phát PUNCH / GUARD / DODGE cho p2.
import { on, emit } from '../events.js';
import { tauntLine, interruptedLine, winLine, loseLine, say } from './taunt.js';

const ME = 'p2';
const TICK_MS = 100;
const HIT_DELAY_MS = 250; // game tính trúng đòn sau 250ms, phản xạ phải nhanh hơn mức này

// Đòn từ tay nào của p1 thì né sang hướng nào. Hai cách hiểu, phải khớp với dodgeAvoids() của game:
//   opposite: tay L → né R      same: tay L → né L
// Chạy `node src/ai/dev/scenarios.mjs` để xem kết quả của từng cách rồi chốt bằng setDodgeMap().
export const DODGE_MAPS = {
  opposite: { L: 'R', R: 'L' },
  same: { L: 'L', R: 'R' },
};
let dodgeMapName = 'opposite';

const flip = (h) => (h === 'L' ? 'R' : 'L');

// Các kiểu phản đòn. Mỗi kiểu trả về [độ trễ ms, tay, loại đòn].
// Né sang bên nào thì trọng tâm dồn về bên đó, nên tay bên đó tung hook.
export const COUNTERS = {
  slipHook: (side) => [[0, side, 'hook']],
  slipJabHook: (side) => [[0, flip(side), 'jab'], [250, side, 'hook']],
  blockReturn: () => {
    const h = Math.random() < 0.5 ? 'L' : 'R';
    return [[0, h, 'jab'], [220, flip(h), 'jab']];
  },
};

export const DIFF = {
  // react: xác suất thủ/né khi p1 đấm · reactMs: độ trễ phản xạ · dodgeBias: xác suất chọn né thay vì đỡ
  // aggro: xác suất ra đòn mỗi nhịp · cooldownMs: nghỉ giữa 2 lần ra đòn · stunMs: khựng khi trúng đòn
  // smartDodge: né đúng hướng · doubleSlip: né liên tiếp khi p1 ra 2 đòn · combo: xác suất jab-jab-hook
  // counter: xác suất phản đòn sau khi thủ/né · slipCounters: các kiểu phản đòn sau khi né
  // guardUp: xác suất tự thủ/né khi chưa ra đòn
  easy: {
    react: 0.2, reactMs: 210, dodgeBias: 0.5, aggro: 0.3, cooldownMs: 1500, stunMs: 350,
    smartDodge: false, doubleSlip: false, combo: 0, counter: 0, slipCounters: [], guardUp: 0.12,
  },
  normal: {
    react: 0.45, reactMs: 160, dodgeBias: 0.5, aggro: 0.4, cooldownMs: 1100, stunMs: 250,
    smartDodge: false, doubleSlip: false, combo: 0.15, counter: 0.3, slipCounters: ['slipHook'], guardUp: 0.12,
  },
  hard: {
    react: 0.7, reactMs: 90, dodgeBias: 0.6, aggro: 0.7, cooldownMs: 600, stunMs: 120,
    smartDodge: true, doubleSlip: true, combo: 0.35, counter: 0.6, slipCounters: ['slipHook', 'slipJabHook'], guardUp: 0.12,
  },
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
let queue = []; // các cú đấm đang chờ: { at, hand, kind }
let reactTimer = null;
let guarding = false;
let dodging = null;
let defense = null; // lần thủ/né hiện tại: { type: 'guard'|'dodge', dir, double, failed }
let lastCounter = null;
let script = []; // các bước khiêu khích đang chờ: { at, act }
let round = 1;
let hp = { p1: 100, p2: 100 };
let tauntEnabled = true;

const p1 = { guard: false, guardSince: 0, dodge: null, lastPunch: 0, pendingUntil: 0 };

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

// Khiêu khích chỉ dùng GUARD / DODGE (không đấm) nên render và game không cần sửa gì.
const TAUNTS = [
  // lắc lư né trái phải
  [[0, () => setDodge('L')], [300, () => setDodge('R')], [600, () => setDodge('L')], [900, () => setDodge(null)]],
  // gõ găng hai lần
  [[0, () => setGuard(true)], [250, () => setGuard(false)], [500, () => setGuard(true)], [750, () => setGuard(false)]],
  // nhún né rồi giơ găng thách thức
  [[0, () => setDodge('R')], [350, () => setDodge(null)], [500, () => setGuard(true)], [1000, () => setGuard(false)]],
];

function startTaunt() {
  const now = Date.now();
  script = rand(TAUNTS).map(([dt, act]) => ({ at: now + dt, act }));
  say(ME, tauntLine({ round, hp }));
  enter('TAUNT');
}

// Ăn mừng khi thắng: chỉ dùng GUARD / DODGE, không đấm để game không tính thêm đòn sau K.O.
const CELEBRATIONS = {
  // nhảy múa lắc lư trái phải
  dance: () => [0, 250, 500, 750, 1000, 1250].map((dt, i) => [dt, () => setDodge(i % 2 ? 'R' : 'L')]).concat([[1500, () => setDodge(null)]]),
  // giơ găng ăn mừng, giữ lâu rồi giơ lại
  gloves: () => [[0, () => setGuard(true)], [900, () => setGuard(false)], [1200, () => setGuard(true)], [2100, () => setGuard(false)]],
  // đi vòng quanh đài: né một bên, giơ găng, né bên kia, giơ găng
  victoryLap: () => [
    [0, () => setDodge('L')], [400, () => setGuard(true)], [800, () => (setGuard(false), setDodge('R'))],
    [1200, () => setGuard(true)], [1600, () => (setGuard(false), setDodge(null))],
  ],
};

const CELEBRATE_DELAY_MS = 700; // chờ animation K.O. chạy xong rồi mới ăn mừng

function celebrate(winner) {
  const routine = rand(Object.keys(CELEBRATIONS));
  emit('CELEBRATE', { who: winner, routine: winner === ME ? routine : null });
  if (winner === ME) {
    const start = Date.now() + CELEBRATE_DELAY_MS;
    script = [[0, () => say(ME, winLine())], ...CELEBRATIONS[routine]()].map(([dt, act]) => ({ at: start + dt, act }));
    enter('CELEBRATE');
    log('celebrate', routine);
  } else {
    // p1 thắng: robot đỏ không cử động được (đã thua), chỉ cay cú một câu
    setTimeout(() => say(ME, loseLine()), CELEBRATE_DELAY_MS);
  }
}

function cancelTaunt() {
  if (state !== 'TAUNT') return;
  script = [];
  releaseDefense();
  say(ME, interruptedLine());
  enter('IDLE');
}

const p1GuardingLong = () => p1.guard && Date.now() - p1.guardSince > 1000;

function defaultPlan() {
  if (Math.random() < cfg.combo) {
    const lead = rand(['L', 'R']);
    return [[0, lead, 'jab'], [280, flip(lead), 'jab'], [600, lead, 'hook']]; // jab - jab - hook
  }
  const kind = p1GuardingLong() ? (Math.random() < 0.8 ? 'hook' : 'jab') : Math.random() < 0.2 ? 'hook' : 'jab';
  return [[0, rand(['L', 'R']), kind]];
}

function startAttack(plan = defaultPlan()) {
  releaseDefense();
  const now = Date.now();
  queue = plan.map(([dt, hand, kind]) => ({ at: now + dt, hand, kind }));
  enter('ATTACK');
}

// Chọn kiểu phản đòn theo lần thủ/né vừa xong. Né hụt (vẫn bị trúng) thì không phản đòn.
function counterPlan(d) {
  if (!d || d.failed) return null;
  if (d.type === 'dodge' && d.dir && cfg.slipCounters.length) {
    const name = d.double && cfg.slipCounters.includes('slipJabHook') ? 'slipJabHook' : rand(cfg.slipCounters);
    return { name, plan: COUNTERS[name](d.dir) };
  }
  if (d.type === 'guard') return { name: 'blockReturn', plan: COUNTERS.blockReturn() };
  return null;
}

function dodgeDirFor(p1Hand) {
  return cfg.smartDodge && p1Hand ? DODGE_MAPS[dodgeMapName][p1Hand] : rand(['L', 'R']);
}

function defend(p1Hand, delay = 0) {
  queue = [];
  if (Math.random() >= cfg.dodgeBias) {
    setDodge(null);
    setGuard(true);
    defense = { type: 'guard' };
    enter('GUARD', between(400, 700));
  } else {
    setGuard(false);
    const dir = dodgeDirFor(p1Hand);
    setDodge(dir);
    defense = { type: 'dodge', dir };
    // né để đáp lại một cú đấm: giữ tới khi cú đấm đó được tính xong rồi phản đòn ngay
    enter('DODGE', p1Hand ? HIT_DELAY_MS - delay + 120 : between(350, 500));
  }
}

// p1 ra đòn thứ hai khi AI còn đang né: né tiếp sang hướng của đòn mới
function doubleSlip(p1Hand) {
  const dir = dodgeDirFor(p1Hand);
  setDodge(dir);
  defense = { type: 'dodge', dir, double: true };
  enter('DODGE', HIT_DELAY_MS - cfg.reactMs + 120);
  log('double slip', dir);
}

function tick() {
  if (!active && state !== 'CELEBRATE') return;
  const now = Date.now();
  const done = now >= stateUntil;

  switch (state) {
    case 'CELEBRATE':
      while (script.length && script[0].at <= now) script.shift().act();
      if (!script.length) {
        releaseDefense();
        enter('IDLE');
      }
      break;

    case 'TAUNT':
      while (script.length && script[0].at <= now) script.shift().act();
      if (!script.length) {
        releaseDefense();
        enter('RECOVER', 300);
      }
      break;

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
      else if (Math.random() < cfg.guardUp) defend(null); // thỉnh thoảng thủ chủ động
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
      // giữ thủ/né tới khi mọi cú đấm của p1 đang bay đã được tính xong
      if (done && now >= p1.pendingUntil) {
        releaseDefense();
        const c = Math.random() < cfg.counter ? counterPlan(defense) : null;
        defense = null;
        if (c) {
          lastCounter = { name: c.name, at: now };
          log('counter', c.name);
          startAttack(c.plan);
        } else enter('RECOVER', 150);
      }
      break;

    case 'RECOVER':
      if (done) enter('IDLE');
      break;
  }
}

function onP1Punch({ hand }) {
  p1.lastPunch = Date.now();
  p1.pendingUntil = p1.lastPunch + HIT_DELAY_MS + 50;
  if (!active || reactTimer) return;
  cancelTaunt(); // p1 đấm lúc đang khiêu khích thì thôi diễn, vào trận luôn
  if (state === 'GUARD') return;
  if (state === 'DODGE' && !cfg.doubleSlip) return;
  if (Math.random() >= cfg.react) return;
  const delay = Math.min(cfg.reactMs, HIT_DELAY_MS - 30);
  reactTimer = setTimeout(() => {
    reactTimer = null;
    if (!active) return;
    if (state === 'DODGE') doubleSlip(hand);
    else defend(hand, delay);
  }, delay);
}

function reset() {
  clearTimeout(reactTimer);
  reactTimer = null;
  queue = [];
  script = [];
  defense = null;
  stunUntil = 0;
  releaseDefense();
  enter('IDLE');
}

// overrides: chỉnh tạm vài thông số (dùng cho kịch bản test), ví dụ { react: 1, dodgeBias: 1 }
export function setDifficulty(name, overrides = {}) {
  if (!DIFF[name]) return;
  diffName = name;
  cfg = { ...DIFF[name], ...overrides };
  log('difficulty', name, overrides);
}

export function setDodgeMap(name) {
  if (!DODGE_MAPS[name]) return;
  dodgeMapName = name;
  log('dodge map', name);
}

export const getDifficulty = () => diffName;
export const getDodgeMap = () => dodgeMapName;
export const getState = () => state;
export const getLastCounter = () => lastCounter;

export function startOpponent({ difficulty = 'normal', debug: dbg = false, taunt = true, dodgeMap } = {}) {
  setDifficulty(difficulty);
  if (dodgeMap) setDodgeMap(dodgeMap);
  debug = dbg;
  tauntEnabled = taunt;
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
    // bị trúng đòn thì khựng lại một chút, bỏ combo đang dở; đang né mà vẫn trúng thì mất quyền phản đòn
    if (target === ME && !blocked && active) {
      queue = [];
      stunUntil = Date.now() + cfg.stunMs;
      if (defense) defense.failed = true;
      if (state === 'ATTACK') enter('RECOVER', 0);
    }
  });
  on('HP', (v) => (hp = v));
  on('ROUND', ({ round: r, state: s, winner }) => {
    if (s === 'start') {
      if (r) round = r;
      active = true;
      reset();
      lastAttack = Date.now(); // cho người chơi một nhịp trước cú đầu tiên
      if (tauntEnabled) startTaunt();
    } else if (s === 'end' || s === 'ko') {
      active = false;
      reset();
      if (winner === 'p1' || winner === 'p2') celebrate(winner);
    }
  });

  setInterval(tick, TICK_MS);
}
