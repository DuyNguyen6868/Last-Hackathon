// Thử prompt bình luận và huấn luyện viên với vài hiệp mẫu. Cần server đang chạy (npm run server) và key trong .env.
//   node server/dev/try-commentary.mjs                  gọi http://localhost:8787
//   node server/dev/try-commentary.mjs http://host:port
const BASE = process.argv[2] ?? `http://localhost:${process.env.PORT || 8787}`;

const s = (hp, thrown, landed, blocked, missed) => ({ hp, thrown, landed, blocked, missed });
const SAMPLES = [
  {
    name: 'Hiệp sát nút, ATOM thắng',
    body: { state: 'end', round: 1, winner: 'p1', wins: { p1: 1, p2: 0 }, difficulty: 'normal',
      stats: { round: 1, p1: s(42, 21, 12, 5, 4), p2: s(38, 18, 11, 4, 3) } },
  },
  {
    name: 'ZEUS áp đảo, ATOM đỡ nhiều',
    body: { state: 'end', round: 1, winner: 'p2', wins: { p1: 0, p2: 1 }, difficulty: 'hard',
      stats: { round: 1, p1: s(31, 15, 4, 6, 5), p2: s(88, 24, 14, 9, 1) } },
  },
  {
    name: 'ATOM hạ K.O. ZEUS',
    body: { state: 'ko', round: 2, winner: 'p1', wins: { p1: 2, p2: 0 }, difficulty: 'easy',
      stats: { round: 2, p1: s(64, 26, 19, 3, 4), p2: s(0, 12, 6, 2, 4) } },
  },
  {
    name: 'Hoà, ZEUS hay bị né',
    body: { state: 'end', round: 2, winner: null, wins: { p1: 1, p2: 1 }, difficulty: 'normal',
      stats: { round: 2, p1: s(55, 17, 8, 4, 5), p2: s(55, 20, 8, 3, 9) } },
  },
];

async function post(path, body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - t0, json };
}

const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null);
if (!health) {
  console.error(`Không gọi được ${BASE}. Chạy "npm run server" trước.`);
  process.exit(1);
}
console.log(`Server ${BASE} · model ${health.model}\n`);

for (const { name, body } of SAMPLES) {
  const [c, k] = await Promise.all([post('/commentary', body), post('/coach', body)]);
  console.log(`▶ ${name}`);
  console.log(`  🎙️  [${c.status}, ${c.ms}ms] ${c.json.text ?? JSON.stringify(c.json)}`);
  console.log(`  📋 [${k.status}, ${k.ms}ms] ${JSON.stringify(k.json)}\n`);
}
console.log('Cả hai phải xong dưới ~5 giây (client bỏ cuộc sau 5 giây, nghỉ giữa hiệp chỉ 6 giây).');
