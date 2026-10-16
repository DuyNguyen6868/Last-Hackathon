// Đối thủ AI (p2): máy trạng thái TAUNT (đầu hiệp) → IDLE → APPROACH → ATTACK / GUARD / DODGE → RECOVER,
// và CELEBRATE khi trận kết thúc có người thắng.
// Chỉ giao tiếp qua event bus: nghe hành động của p1, phát PUNCH / GUARD / DODGE cho p2.
import { on, emit } from '../events.js';
import { CONFIG } from '../config.js';
import { setDamageScale } from '../game/game.js';
import { tauntLine, interruptedLine, winLine, loseLine, say } from './taunt.js';

const ME = 'p2';
const TICK_MS = 100;
const HIT_DELAY_MS = CONFIG.hitDelayMs; // game tính trúng đòn sau khoảng này, phản xạ phải nhanh hơn
const GAP = CONFIG.punchCooldownMs + 50; // game bỏ qua cú đấm ra quá sát cú trước, nên combo phải giãn ra
const FOLLOW_UP_WINDUP = 0.55; // các đòn nối tiếp trong combo lấy đà ngắn hơn cú đầu

// Đòn từ tay nào của p1 thì né sang hướng nào:   opposite: tay L → né R      same: tay L → né L
// game.js tính né theo thời gian (CONFIG.dodgeWindowMs), không theo hướng, nên đây chỉ là chuyện hình ảnh.
// Chốt 'same': dodge_L đẩy robot sang trái của chính nó, tức là tránh xa nắm đấm trái của p1 (hai robot đối mặt).
export const DODGE_MAPS = {
  opposite: { L: 'R', R: 'L' },
  same: { L: 'L', R: 'R' },
};
let dodgeMapName = 'same';

const flip = (h) => (h === 'L' ? 'R' : 'L');

// Các kiểu phản đòn. Mỗi kiểu trả về [độ trễ ms, tay, loại đòn].
// Né sang bên nào thì trọng tâm dồn về bên đó, nên tay bên đó tung hook.
export const COUNTERS = {
  slipHook: (side) => [[0, side, 'hook']],
  slipJabHook: (side) => [[0, flip(side), 'jab'], [GAP, side, 'hook']],
  blockReturn: () => {
    const h = Math.random() < 0.5 ? 'L' : 'R';
    return [[0, h, 'jab'], [GAP, flip(h), 'jab']];
  },
};

export const DIFF = {
  // react: xác suất thủ/né khi p1 đấm · reactMs: độ trễ phản xạ · dodgeBias: xác suất chọn né thay vì đỡ
  // aggro: xác suất ra đòn mỗi nhịp · cooldownMs: nghỉ giữa 2 lần ra đòn · stunMs: khựng khi trúng đòn
  // smartDodge: né đúng hướng · doubleSlip: né liên tiếp khi p1 ra 2 đòn · combo: xác suất jab-jab-hook
  // counter: xác suất phản đòn sau khi thủ/né · slipCounters: các kiểu phản đòn sau khi né
  // guardUp: xác suất tự thủ/né khi chưa ra đòn · hookBias: xác suất đấm hook thay vì jab
  // windupMs: lấy đà (găng sáng cam) trước khi đấm, người chơi có windupMs + hitDelayMs để né/đỡ
  // damage: hệ số sát thương của ZEUS
  easy: {
    react: 0.2, reactMs: 210, dodgeBias: 0.5, aggro: 0.3, cooldownMs: 1500, stunMs: 350, hookBias: 0.15,
    smartDodge: false, doubleSlip: false, combo: 0, counter: 0, slipCounters: [], guardUp: 0.12,
    windupMs: 750, damage: 0.5,
  },
  normal: {
    react: 0.62, reactMs: 160, dodgeBias: 0.5, aggro: 0.62, cooldownMs: 780, stunMs: 250, hookBias: 0.2,
    smartDodge: false, doubleSlip: false, combo: 0.15, counter: 0.25, slipCounters: ['slipHook'], guardUp: 0.12,
    windupMs: 360, damage: 1.0,
  },
  hard: {
    react: 0.86, reactMs: 90, dodgeBias: 0.6, aggro: 0.8, cooldownMs: 550, stunMs: 120, hookBias: 0.25,
    smartDodge: true, doubleSlip: true, combo: 0.35, counter: 0.72, slipCounters: ['slipHook', 'slipJabHook'], guardUp: 0.12,
    windupMs: 280, damage: 1.0,
  },
};

const LOW_HP = 30; // dưới mức máu này ZEUS thủ nhiều hơn, đánh ít hơn

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.random() * (b - a);
const power = () => 0.5 + Math.random() * 0.5;

let cfg = DIFF.normal;
let diffName = 'normal';
let testOverrides = {}; // chỉnh tạm cho kịch bản test
let tactics = {}; // chiến thuật huấn luyện viên đặt giữa các hiệp (xem applyTactics)
let debug = false;
let active = false;
let started = false;

let state = 'IDLE';
let stateUntil = 0;
let stunUntil = 0;
let lastAttack = 0;
let queue = []; // các cú đấm đang chờ: { at, hand, kind }
let chain = false; // đã ra cú đầu của lượt tấn công này chưa
let windupTimer = null; // cú đấm đang lấy đà
let reactTimer = null;
let guarding = false;
let dodging = null;
let defense = null; // lần thủ/né hiện tại: { type: 'guard'|'dodge', dir, double, failed }
let lastCounter = null;
let script = []; // các bước khiêu khích đang chờ: { at, act }
let round = 1;
let hp = { p1: 100, p2: 100 };
let wins = null;
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

// Lấy đà rồi mới đấm: phát TELEGRAPH (render làm găng sáng cam, kêu tiếng nạp lực), sau windup mới phát PUNCH
function punch(hand, kind, followUp = false) {
  const windup = Math.round(followUp ? Math.max(cfg.windupMs * FOLLOW_UP_WINDUP, 250) : cfg.windupMs);
  lastAttack = Date.now() + windup; // GAP tính từ lúc cú đấm thật sự ra
  emit('TELEGRAPH', { who: ME, hand, kind, ms: windup });
  windupTimer = setTimeout(() => {
    windupTimer = null;
    emit('PUNCH', { who: ME, hand, kind, power: power() });
  }, windup);
}

// Huỷ cú đang lấy đà (bị trúng đòn, chuyển sang thủ, hết hiệp)
function cancelWindup() {
  if (!windupTimer) return;
  clearTimeout(windupTimer);
  windupTimer = null;
  emit('ANIM', { who: ME, name: 'idle' }); // tắt găng sáng cam
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
  say(ME, tauntLine({ round, hp, wins }));
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

const CELEBRATE_DELAY_MS = 300; // 'over' đến sau K.O. CONFIG.matchEndDelayMs rồi, chỉ chờ thêm chút

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
const lowHp = () => hp.p2 < LOW_HP;

function defaultPlan() {
  if (Math.random() < cfg.combo) {
    const lead = rand(['L', 'R']);
    return [[0, lead, 'jab'], [GAP, flip(lead), 'jab'], [2 * GAP, lead, 'hook']]; // jab - jab - hook
  }
  const kind = p1GuardingLong() ? (Math.random() < 0.8 ? 'hook' : 'jab') : Math.random() < cfg.hookBias ? 'hook' : 'jab';
  return [[0, rand(['L', 'R']), kind]];
}

// quick: phản đòn sau khi thủ/né lấy đà ngắn ngay từ cú đầu (giống đòn nối trong combo)
function startAttack(plan = defaultPlan(), { quick = false } = {}) {
  releaseDefense();
  const now = Date.now();
  queue = plan.map(([dt, hand, kind]) => ({ at: now + dt, hand, kind }));
  chain = quick;
  enter('ATTACK');
  firePunches(now); // cú đầu ra ngay, không chờ tick sau (nếu chờ thì khoảng cách tới cú sau bị ngắn lại)
}

function firePunches(now) {
  // game bỏ qua cú đấm ra quá sát cú trước, nên luôn giữ đủ khoảng GAP
  while (queue.length && queue[0].at <= now && now - lastAttack >= GAP) {
    const p = queue.shift();
    punch(p.hand, p.kind, chain);
    chain = true;
  }
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
  cancelWindup();
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
  if (!active && state !== 'CELEBRATE' && state !== 'TAUNT') return;
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
      let aggro = Math.min(1, cfg.aggro + (p1GuardingLong() ? 0.25 : 0) + (opening ? 0.2 : 0));
      if (lowHp()) aggro *= 0.7; // máu thấp thì bớt liều
      if (ready && Math.random() < aggro) startAttack();
      else if (Math.random() < cfg.guardUp + (lowHp() ? 0.1 : 0)) defend(null); // thỉnh thoảng thủ chủ động
      else enter('APPROACH', between(150, 350)); // chưa ra đòn thì nhử thêm một nhịp
      break;
    }

    case 'ATTACK':
      firePunches(now);
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
          startAttack(c.plan, { quick: true });
        } else enter('RECOVER', 150);
      }
      break;

    case 'RECOVER':
      if (done) enter('IDLE');
      break;
  }
}

// Chỉ gọi cho cú đấm game đã nhận (game.js phát ANIM jab_/hook_), không phản ứng với cú bị game bỏ qua
function onP1Punch(hand) {
  p1.lastPunch = Date.now();
  p1.pendingUntil = p1.lastPunch + HIT_DELAY_MS + 50;
  if (!active || reactTimer) return;
  if (state === 'GUARD') return;
  if (state === 'DODGE' && !cfg.doubleSlip) return;
  if (Math.random() >= cfg.react + (lowHp() ? 0.1 : 0)) return;
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
  cancelWindup();
  script = [];
  defense = null;
  stunUntil = 0;
  releaseDefense();
  enter('IDLE');
}

function rebuildCfg() {
  cfg = { ...DIFF[diffName], ...tactics, ...testOverrides };
  setDamageScale(ME, cfg.damage);
}

// overrides: chỉnh tạm vài thông số (dùng cho kịch bản test), ví dụ { react: 1, dodgeBias: 1 }
// Đổi độ khó thì bỏ chiến thuật huấn luyện viên đã đặt.
export function setDifficulty(name, overrides = {}) {
  if (!DIFF[name]) return;
  diffName = name;
  testOverrides = overrides;
  tactics = {};
  rebuildCfg();
  log('difficulty', name, overrides);
}

// Chiến thuật từ huấn luyện viên (src/ai/coach.js), luôn giữ trong giới hạn của mức khó hiện tại:
//   aggro: 'up' | 'same' | 'down'   ·   favor: 'jab' | 'hook' | 'mixed'   ·   defense: 'guard' | 'dodge' | 'balanced'
export function applyTactics({ aggro = 'same', favor = 'mixed', defense = 'balanced' } = {}) {
  const base = DIFF[diffName];
  const clamp = (v) => Math.min(0.95, Math.max(0.05, v));
  tactics = {
    aggro: clamp(base.aggro + (aggro === 'up' ? 0.15 : aggro === 'down' ? -0.15 : 0)),
    hookBias: favor === 'hook' ? 0.5 : favor === 'jab' ? 0.1 : base.hookBias,
    dodgeBias: defense === 'dodge' ? 0.7 : defense === 'guard' ? 0.3 : base.dodgeBias,
  };
  rebuildCfg();
  log('tactics', { aggro, favor, defense }, tactics);
  return tactics;
}

export const getTactics = () => tactics;

export function setDodgeMap(name) {
  if (!DODGE_MAPS[name]) return;
  dodgeMapName = name;
  log('dodge map', name);
}

export const getDifficulty = () => diffName;
export const getDodgeMap = () => dodgeMapName;
export const getState = () => state;
export const getLastCounter = () => lastCounter;

export function startOpponent({ difficulty = 'normal', debug: dbg = false, taunt = true, dodgeMap, autoTick = true } = {}) {
  setDifficulty(difficulty);
  if (dodgeMap) setDodgeMap(dodgeMap);
  debug = dbg;
  tauntEnabled = taunt;
  if (started) return;
  started = true;

  // p1 bấm đấm lúc đang đếm ngược (game không nhận) vẫn làm ZEUS bỏ dở màn khiêu khích
  on('PUNCH', (e) => e.who === 'p1' && cancelTaunt());
  on('ANIM', ({ who, name }) => {
    const m = who === 'p1' && /^(jab|hook)_([LR])$/.exec(name);
    if (m) onP1Punch(m[2]);
  });
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
      cancelWindup();
      stunUntil = Date.now() + Math.max(cfg.stunMs, CONFIG.hitStunMs);
      if (defense) defense.failed = true;
      if (state === 'ATTACK') enter('RECOVER', 0);
    }
  });
  on('HP', (v) => (hp = v));
  // game.js: countdown → fight → end | ko → over. Vẫn nhận 'start' theo HUONG_DAN (dùng trong kịch bản test).
  on('ROUND', ({ round: r, state: s, winner, wins: w }) => {
    if (r) round = r;
    if (w) wins = w;
    if (s === 'countdown') {
      active = false;
      reset();
      if (round === 1 && Object.keys(tactics).length) {
        tactics = {}; // trận mới: bỏ chiến thuật của trận trước
        rebuildCfg();
      }
      if (tauntEnabled) startTaunt(); // khiêu khích trong lúc đếm ngược
    } else if (s === 'fight' || s === 'start') {
      const taunting = state === 'TAUNT';
      active = true;
      if (!taunting) reset();
      lastAttack = Date.now(); // cho người chơi một nhịp trước cú đầu tiên
      if (s === 'start' && tauntEnabled) startTaunt();
    } else if (s === 'end' || s === 'ko') {
      active = false;
      reset();
    } else if (s === 'over' && (winner === 'p1' || winner === 'p2')) {
      celebrate(winner); // ăn mừng người thắng cả trận
    }
  });

  if (autoTick) setInterval(tick, TICK_MS);
}

// Giao diện main.js đang dùng: const opponent = createOpponent(); opponent.setLevel(lv); opponent.update(dt, now)
export function createOpponent() {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  startOpponent({ debug: params.has('aidebug'), dodgeMap: params.get('dodge') ?? undefined, autoTick: false });
  let acc = 0;
  return {
    setLevel: (level) => setDifficulty(DIFF[level] ? level : 'normal'),
    update(dt) {
      acc += dt * 1000;
      if (acc < TICK_MS) return;
      acc = 0;
      tick();
    },
  };
}
