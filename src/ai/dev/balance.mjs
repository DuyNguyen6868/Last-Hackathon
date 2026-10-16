// Cân bằng độ khó: cho 2 kiểu người chơi giả đấu nhiều trận đầy đủ với ZEUS, dùng luật thật trong game.js.
// Chạy trên đồng hồ ảo nên hàng chục trận 3 hiệp × 60 giây xong trong vài giây.
//   node src/ai/dev/balance.mjs              30 trận mỗi ô
//   node src/ai/dev/balance.mjs --matches 100
//
// Mục tiêu: người chơi bình thường thắng Easy ≥ 80%, Normal ~50%, Hard ≤ 25%; người chơi giỏi thắng Hard ~40–50%.

// ---- đồng hồ ảo: phải cài trước khi game/AI chạy ----
let clock = 0;
let seq = 0;
const timers = [];
globalThis.setTimeout = (fn, ms = 0, ...a) => {
  timers.push({ id: ++seq, at: clock + Math.max(0, ms), fn: () => fn(...a) });
  return seq;
};
globalThis.clearTimeout = (id) => {
  const i = timers.findIndex((t) => t.id === id);
  if (i >= 0) timers.splice(i, 1);
};
globalThis.setInterval = () => {
  throw new Error('balance.mjs: dùng createOpponent().update thay vì setInterval');
};
Date.now = () => 1e12 + clock;
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true });

function advance(ms) {
  const end = clock + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    if (!timers.length || timers[0].at > end) break;
    const t = timers.shift();
    clock = t.at;
    t.fn();
  }
  clock = end;
}

const { on, emit } = await import('../../events.js');
const { game, startMatch, updateGame } = await import('../../game/game.js');
const { createOpponent } = await import('../opponent.js');

const args = process.argv.slice(2);
const MATCHES = Number(args[args.indexOf('--matches') + 1]) || 30;
const between = (a, b) => a + Math.random() * (b - a);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- người chơi giả ----
// Người chơi thật đứng trước webcam phản ứng chậm (thời gian phản xạ + độ trễ vision). ZEUS lấy đà
// (TELEGRAPH, găng sáng cam) windupMs trước mỗi cú, nên người chơi có thể thấy rồi đỡ/né nếu đủ nhanh.
function makeBot({ punchEvery, hookRate, reactMs, guardOnTelegraph, dodgeOnTelegraph, punishAfterBlock, randomGuard }) {
  let nextPunch = 0;
  let releaseAt = 0;
  const p1 = (type, payload) => emit(type, { who: 'p1', ...payload });

  on('TELEGRAPH', ({ who }) => {
    if (who !== 'p2' || game.phase !== 'fight') return;
    const r = Math.random();
    if (r >= guardOnTelegraph + dodgeOnTelegraph) return; // không để ý
    setTimeout(() => {
      if (game.phase !== 'fight') return;
      if (r < guardOnTelegraph) {
        p1('GUARD', { on: true });
        releaseAt = clock + between(400, 700);
      } else {
        p1('DODGE', { dir: rand(['L', 'R']) });
        releaseAt = clock + 450;
      }
    }, between(...reactMs));
  });
  on('HIT', ({ target, blocked }) => {
    // đỡ được thì đấm trả ngay
    if (target === 'p1' && blocked && Math.random() < punishAfterBlock) nextPunch = Math.min(nextPunch, clock + 120);
  });

  return {
    reset() {
      nextPunch = clock + between(...punchEvery);
      releaseAt = 0;
    },
    update() {
      if (game.phase !== 'fight') return;
      const me = game.f.p1;
      if (releaseAt && clock >= releaseAt) {
        if (me.guard) p1('GUARD', { on: false });
        if (me.dodge) p1('DODGE', { dir: null });
        releaseAt = 0;
      }
      if (!releaseAt && Math.random() < randomGuard) {
        p1('GUARD', { on: true });
        releaseAt = clock + between(500, 900);
      }
      if (clock >= nextPunch && !me.guard) {
        p1('PUNCH', { hand: rand(['L', 'R']), kind: Math.random() < hookRate ? 'hook' : 'jab', power: between(0.5, 1) });
        nextPunch = clock + between(...punchEvery);
      }
    },
  };
}

const BOTS = {
  casual: {
    punchEvery: [900, 1500], hookRate: 0.3, reactMs: [400, 650], guardOnTelegraph: 0.25, dodgeOnTelegraph: 0.1,
    punishAfterBlock: 0.1, randomGuard: 0.002,
  },
  skilled: {
    punchEvery: [550, 900], hookRate: 0.35, reactMs: [300, 450], guardOnTelegraph: 0.4, dodgeOnTelegraph: 0.3,
    punishAfterBlock: 0.6, randomGuard: 0.004,
  },
};

// ---- chạy trận ----
let result = null;
on('ROUND', (r) => {
  if (r.state === 'ko' && result) result.ko = r.winner;
  if (r.state === 'over' && result) {
    result.winner = r.winner;
    result.wins = r.wins;
  }
});

const FRAME = 1000 / 60;

function playMatch(opponent, bot) {
  result = { winner: undefined, ko: null, landed: { p1: 0, p2: 0 }, thrown: { p1: 0, p2: 0 } };
  startMatch();
  let lastRound = 0;
  for (let i = 0; i < 60 * 60 * 5 && result.winner === undefined; i++) {
    advance(FRAME);
    updateGame(FRAME / 1000);
    opponent.update(FRAME / 1000);
    if (game.phase === 'fight' && game.round !== lastRound) {
      lastRound = game.round;
      bot.reset();
    }
    bot.update();
  }
  return result;
}

on('HIT', ({ attacker, blocked }) => result && !blocked && result.landed[attacker]++);
on('ANIM', ({ who, name }) => result && /^(jab|hook)_/.test(name) && result.thrown[who]++);

const opponent = createOpponent();
const pct = (a, b) => `${Math.round((100 * a) / b)}%`.padStart(5);

console.log(`${MATCHES} trận mỗi ô (3 hiệp × ${60} giây, luật thật của game.js)\n`);
console.log('người chơi  độ khó   p1 thắng  hoà  p1 KO  ZEUS KO   đòn trúng p1/ZEUS mỗi trận');
for (const [botName, botCfg] of Object.entries(BOTS)) {
  const bot = makeBot(botCfg);
  for (const level of ['easy', 'normal', 'hard']) {
    opponent.setLevel(level);
    const agg = { p1: 0, draw: 0, koP1: 0, koP2: 0, landedP1: 0, landedP2: 0 };
    for (let m = 0; m < MATCHES; m++) {
      const r = playMatch(opponent, bot);
      if (r.winner === 'p1') agg.p1++;
      else if (!r.winner) agg.draw++;
      if (r.ko === 'p1') agg.koP1++;
      if (r.ko === 'p2') agg.koP2++;
      agg.landedP1 += r.landed.p1;
      agg.landedP2 += r.landed.p2;
    }
    console.log(
      `${botName.padEnd(10)}  ${level.padEnd(6)}   ${pct(agg.p1, MATCHES)}   ${pct(agg.draw, MATCHES)}  ${pct(agg.koP1, MATCHES)}   ${pct(agg.koP2, MATCHES)}` +
        `      ${(agg.landedP1 / MATCHES).toFixed(1).padStart(5)} / ${(agg.landedP2 / MATCHES).toFixed(1)}`,
    );
  }
}
process.exit(0);
