// Kịch bản test né và phản đòn của AI, chạy với luật thật trong src/game/game.js (không cần trình duyệt):
//   node src/ai/dev/scenarios.mjs              bảng kết quả
//   node src/ai/dev/scenarios.mjs --verbose    in thêm diễn biến từng kịch bản
//   node src/ai/dev/scenarios.mjs --runs 10    số lần chạy mỗi kịch bản (mặc định 3)
//
// Luật né của game: né theo hướng nào cũng được, chỉ cần đang trong CONFIG.dodgeWindowMs kể từ lúc bắt đầu né.
// Hướng né của AI (DODGE_MAPS, mặc định 'same') chỉ ảnh hưởng hình ảnh và tay dùng để phản đòn.
import { on, emit } from '../../events.js';
import { CONFIG } from '../../config.js';
import { startMatch } from '../../game/game.js';
import { startOpponent, setDifficulty, getLastCounter, getDodgeMap } from '../opponent.js';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const RUNS = Number(args[args.indexOf('--runs') + 1]) || 3;

CONFIG.countdownMs = 0; // vào trận ngay, khỏi chờ đếm ngược
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- ghi lại diễn biến ----
let log = [];
let t0 = Date.now();
const t = () => Date.now() - t0;
const pending = { p1: [], p2: [] }; // các cú đấm đang chờ game tính kết quả

on('GUARD', ({ who, on: v }) => log.push({ t: t(), who, ev: 'GUARD', v }));
on('DODGE', ({ who, dir }) => log.push({ t: t(), who, ev: 'DODGE', dir }));
// game.js nhận PUNCH trước script này (đăng ký lúc import) và phát ANIM ngay nếu chấp nhận cú đấm,
// sau đó phát HIT/MISS khi tính xong
const accepted = { p1: false, p2: false };
on('ANIM', ({ who, name }) => {
  if (/^(jab|hook)_/.test(name)) accepted[who] = true;
});
on('PUNCH', ({ who, hand, kind }) => {
  const e = { t: t(), who, ev: 'PUNCH', hand, kind, result: accepted[who] ? 'đang bay' : 'bị game bỏ qua' };
  accepted[who] = false;
  if (who === 'p2') e.counter = getLastCounter()?.name;
  log.push(e);
  pending[who].push(e);
});
const settle = (attacker, result) => {
  const e = pending[attacker].find((p) => p.result === 'đang bay');
  if (e) e.result = result;
};
on('HIT', ({ attacker, blocked }) => settle(attacker, blocked ? 'blocked' : 'hit'));
on('MISS', ({ attacker }) => settle(attacker, 'dodged'));

// p1 đọc được đòn phản: 100ms sau khi p2 ra đòn thì né
let p1ReadsCounters = false;
on('PUNCH', ({ who }) => {
  if (who !== 'p2' || !p1ReadsCounters) return;
  setTimeout(() => {
    emit('DODGE', { who: 'p1', dir: 'L' });
    setTimeout(() => emit('DODGE', { who: 'p1', dir: null }), 450);
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
      await wait(CONFIG.punchCooldownMs + 30);
      p1Punch('R');
    },
  },
  { name: 'p1 né được đòn phản', readsCounters: true, run: async () => p1Punch('R') },
];

// Ép AI luôn phản xạ bằng né và luôn phản đòn, không tự tấn công, để kết quả lặp lại được
const FORCED = { react: 1, dodgeBias: 1, counter: 1, aggro: 0, guardUp: 0 };

async function runOnce(sc) {
  p1ReadsCounters = !!sc.readsCounters;
  startMatch();
  await wait(50); // chờ game sang 'fight'
  log = [];
  pending.p1 = [];
  pending.p2 = [];
  t0 = Date.now();
  await sc.run();
  await wait(1600);
  return log.slice();
}

function summarize(runs) {
  const s = { p1Punches: 0, p1Dodged: 0, counters: 0, counterHit: 0, counterDodged: 0, ignored: 0, names: new Set() };
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
        if (e.result === 'bị game bỏ qua') s.ignored++;
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
// game.js so performance.now() với lastPunch = 0; trong Node đồng hồ này bắt đầu từ lúc chạy nên phải chờ một chút
await wait(CONFIG.punchCooldownMs + 50);
setDifficulty('hard', FORCED);

console.log(`Luật thật của game · AI né kiểu '${getDodgeMap()}' · ${RUNS} lần mỗi kịch bản`);
console.log('   kịch bản                  AI né trúng  số đòn phản   đòn phản trúng   p1 né được   game bỏ qua');
for (const sc of SCENARIOS) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await runOnce(sc));
  const s = summarize(runs);
  console.log(
    `   ${sc.name.padEnd(24)}  ${pct(s.p1Dodged, s.p1Punches).padStart(9)}  ${String(s.counters).padStart(11)}` +
      `   ${pct(s.counterHit, s.counters).padStart(14)}   ${pct(s.counterDodged, s.counters).padStart(10)}` +
      `   ${String(s.ignored).padStart(11)}   ${[...s.names].join(', ')}`,
  );
  if (VERBOSE) printTimeline(runs[0]);
}

console.log(`
Đọc kết quả:
- AI né trúng: phần trăm cú đấm của p1 bị AI né (game tính MISS).
- Đòn phản trúng / p1 né được: kết quả các cú phản đòn của AI khi p1 đứng yên / khi p1 né kịp.
- Game bỏ qua: cú đấm AI tung ra nhưng game không nhận (quá sát cú trước, đang choáng, đang đỡ). Phải bằng 0.`);
process.exit(0);
