// Kịch bản test né và phản đòn của AI, chạy bằng Node (không cần trình duyệt):
//   node src/ai/dev/scenarios.mjs              bảng kết quả cho cả 2 luật né × 2 cách AI né
//   node src/ai/dev/scenarios.mjs --verbose    in thêm diễn biến từng kịch bản
//   node src/ai/dev/scenarios.mjs --runs 10    số lần chạy mỗi kịch bản (mặc định 3)
//
// Game giả ở đây làm theo HUONG_DAN §8.3 (đòn tính sau 250ms), với dodgeAvoids() theo một trong hai luật:
//   opposite: né R tránh được tay L của đối thủ, né L tránh tay R
//   same:     né L tránh được tay L của đối thủ, né R tránh tay R
// Luật của game và DODGE_MAPS của AI phải giống nhau, nếu không AI né sai phía và mất phản đòn.
import { on, emit } from '../../events.js';
import { startOpponent, setDifficulty, setDodgeMap, getLastCounter, DODGE_MAPS } from '../opponent.js';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const RUNS = Number(args[args.indexOf('--runs') + 1]) || 3;

const RULES = Object.keys(DODGE_MAPS); // ['opposite', 'same']
const other = (w) => (w === 'p1' ? 'p2' : 'p1');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- game giả ----
let rule = 'opposite';
let st, hp, log, t0;
const dodgeAvoids = (dir, hand) => DODGE_MAPS[rule][hand] === dir;
const t = () => Date.now() - t0;

function resetGame() {
  st = { p1: { guard: false, dodge: null }, p2: { guard: false, dodge: null } };
  hp = { p1: 100, p2: 100 };
  log = [];
  t0 = Date.now();
}

on('GUARD', ({ who, on: v }) => {
  st[who].guard = v;
  log.push({ t: t(), who, ev: 'GUARD', v });
});
on('DODGE', ({ who, dir }) => {
  st[who].dodge = dir;
  log.push({ t: t(), who, ev: 'DODGE', dir });
});
on('PUNCH', ({ who, hand, kind, power }) => {
  const entry = { t: t(), who, ev: 'PUNCH', hand, kind, result: null };
  if (who === 'p2') entry.counter = getLastCounter()?.name;
  log.push(entry);
  setTimeout(() => {
    const tg = other(who);
    if (st[tg].dodge && dodgeAvoids(st[tg].dodge, hand)) return (entry.result = 'dodged');
    const blocked = st[tg].guard;
    const dmg = (kind === 'hook' ? 10 : 5) * (0.5 + power * 0.5) * (blocked ? 0.2 : 1);
    hp[tg] = Math.max(0, hp[tg] - dmg);
    entry.result = blocked ? 'blocked' : 'hit';
    emit('HIT', { target: tg, damage: dmg, blocked });
    emit('HP', hp);
  }, 250);
});

// p1 đọc được đòn phản: 100ms sau khi p2 ra đòn thì né đúng phía (theo luật của game)
let p1ReadsCounters = false;
on('PUNCH', ({ who, hand }) => {
  if (who !== 'p2' || !p1ReadsCounters) return;
  setTimeout(() => {
    emit('DODGE', { who: 'p1', dir: DODGE_MAPS[rule][hand] });
    setTimeout(() => emit('DODGE', { who: 'p1', dir: null }), 400);
  }, 100);
});

const p1Punch = (hand, kind = 'jab') => emit('PUNCH', { who: 'p1', hand, kind, power: 0.8 });

// ---- kịch bản ----
const SCENARIOS = [
  { name: 'Jab trái', run: async () => p1Punch('L') },
  { name: 'Jab phải', run: async () => p1Punch('R') },
  { name: 'Hook trái', run: async () => p1Punch('L', 'hook') },
  {
    name: 'Một-hai (L rồi R)',
    run: async () => {
      p1Punch('L');
      await wait(300);
      p1Punch('R');
    },
  },
  {
    name: 'p1 né được đòn phản',
    readsCounters: true,
    run: async () => p1Punch('R'),
  },
];

// Ép AI luôn phản xạ bằng né và luôn phản đòn, không tự tấn công, để kết quả lặp lại được
const FORCED = { react: 1, dodgeBias: 1, counter: 1, aggro: 0, guardUp: 0 };

async function runOnce(sc) {
  resetGame();
  p1ReadsCounters = !!sc.readsCounters;
  emit('ROUND', { round: 1, state: 'start' });
  await wait(150);
  t0 = Date.now();
  await sc.run();
  await wait(1300);
  emit('ROUND', { round: 1, state: 'end' });
  await wait(50);
  return log.slice();
}

function summarize(runs) {
  const s = { p1Punches: 0, p1Dodged: 0, counters: 0, counterHit: 0, counterDodged: 0, names: new Set() };
  for (const events of runs) {
    for (const e of events) {
      if (e.ev !== 'PUNCH') continue;
      if (e.who === 'p1') {
        s.p1Punches++;
        if (e.result === 'dodged') s.p1Dodged++;
      } else if (e.counter) {
        s.counters++;
        s.names.add(e.counter);
        if (e.result === 'hit') s.counterHit++;
        if (e.result === 'dodged') s.counterDodged++;
      }
    }
  }
  return s;
}

function printTimeline(events) {
  for (const e of events) {
    const what =
      e.ev === 'PUNCH' ? `PUNCH ${e.kind}_${e.hand} → ${e.result}${e.counter ? ` (phản đòn: ${e.counter})` : ''}`
      : e.ev === 'DODGE' ? `DODGE ${e.dir ?? 'về giữa'}`
      : `GUARD ${e.v ? 'bật' : 'tắt'}`;
    console.log(`      ${String(e.t).padStart(5)}ms  ${e.who}  ${what}`);
  }
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');

startOpponent({ difficulty: 'hard', taunt: false });

for (const gameRule of RULES) {
  for (const aiMap of RULES) {
    rule = gameRule;
    setDodgeMap(aiMap);
    setDifficulty('hard', FORCED);
    const match = gameRule === aiMap;
    console.log(`\n=== Game: ${gameRule} · AI: ${aiMap} ${match ? '✅ khớp' : '❌ lệch'}`);
    console.log('   kịch bản                  AI né trúng  số đòn phản   đòn phản trúng   p1 né được đòn phản');
    for (const sc of SCENARIOS) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await runOnce(sc));
      const s = summarize(runs);
      console.log(
        `   ${sc.name.padEnd(24)}  ${pct(s.p1Dodged, s.p1Punches).padStart(9)}   ${String(s.counters).padStart(11)}` +
          `   ${pct(s.counterHit, s.counters).padStart(14)}   ${pct(s.counterDodged, s.counters).padStart(19)}` +
          `   ${[...s.names].join(', ')}`,
      );
      if (VERBOSE && match) printTimeline(runs[0]);
    }
  }
}

console.log(`
Đọc kết quả:
- Khi khớp, AI né được 100% đòn và phản đòn sau mỗi lần né. Khi lệch, AI né sai phía, bị trúng đòn nên không phản đòn.
- "p1 né được phản đòn" kiểm tra chiều ngược lại: người chơi né đúng phía thì đòn phản của AI trượt.
- Chọn luật cho dodgeAvoids() trong game, rồi đặt cùng tên cho AI: initAI({ dodgeMap: '<tên>' }) hoặc ?dodge=<tên>.`);
process.exit(0);
