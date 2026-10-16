// Proxy nhỏ gọi Claude: bình luận giữa hiệp và huấn luyện viên chọn chiến thuật cho ZEUS. API key chỉ nằm trong .env.
// Chạy: npm run server (cổng 8787). Vite proxy /api sang đây, nên mỗi route nhận cả /x và /api/x.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
// Chọn model bằng CLAUDE_MODEL trong .env (xem .env.example), không đặt thì dùng Haiku cho nhanh
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
// Fallback phía server khi model từ chối trả lời: chỉ các model này hỗ trợ
const SUPPORTS_FALLBACK = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'].includes(MODEL);

const NAMES = { p1: 'ATOM', p2: 'ZEUS' };
const STATS_LEGEND =
  'thrown = số đòn tung ra, landed = trúng, blocked = bị đối thủ đỡ, missed = bị đối thủ né, hp = máu còn lại /100';

const COMMENTARY_SYSTEM = `Bạn là bình luận viên giải đấm bốc robot "Reel Steel" trên truyền hình, giọng hào hứng, kịch tính.
ATOM (robot xanh) do người chơi thật điều khiển bằng cách đấm trước webcam. ZEUS (robot đỏ) do AI điều khiển.
Viết đúng 1–2 câu tiếng Việt, tổng dưới 40 từ, nhắc ít nhất một con số cụ thể trong số liệu.
Nếu ATOM thua hiệp, kết bằng một lời khuyên chiến thuật thật ngắn cho ATOM.
Chỉ trả về câu bình luận: không markdown, không dấu ngoặc kép, không tiêu đề.`;

const COACH_SYSTEM = `Bạn là huấn luyện viên của ZEUS (robot đỏ do AI điều khiển) trong giải đấm bốc robot "Reel Steel".
Đối thủ là ATOM (robot xanh) do người chơi thật điều khiển qua webcam.
Đọc số liệu hiệp vừa xong và chọn chiến thuật cho hiệp sau:
- aggro: "up" nếu ZEUS đang thua hoặc ATOM bị động, "down" nếu ZEUS ăn đòn quá nhiều, còn lại "same".
- favor: "hook" nếu ATOM đỡ được nhiều đòn của ZEUS (hook vòng qua găng), "jab" nếu ZEUS hay bị né, còn lại "mixed".
- defense: "guard" nếu ATOM đánh trúng nhiều, "dodge" nếu ATOM ra đòn mạnh nhưng chậm, còn lại "balanced".
- quote: một câu ngắn (dưới 15 từ, tiếng Việt, giọng gắt) huấn luyện viên hét vào tai ZEUS, khớp với chiến thuật đã chọn.`;

const COACH_SCHEMA = {
  type: 'object',
  properties: {
    aggro: { type: 'string', enum: ['up', 'same', 'down'] },
    favor: { type: 'string', enum: ['jab', 'hook', 'mixed'] },
    defense: { type: 'string', enum: ['guard', 'dodge', 'balanced'] },
    quote: { type: 'string' },
  },
  required: ['aggro', 'favor', 'defense', 'quote'],
  additionalProperties: false,
};

const client = new Anthropic();
const app = express();
app.use(cors());
app.use(express.json({ limit: '16kb' }));

// Mô tả hiệp vừa xong bằng chữ cho cả hai prompt
function describeRound({ state, round, winner, stats, wins, difficulty }) {
  return `Sự kiện: ${state === 'ko' ? 'KNOCKOUT' : 'HẾT HIỆP'} · Hiệp ${round ?? '?'} · Độ khó ZEUS: ${difficulty ?? 'normal'}
Người thắng hiệp: ${NAMES[winner] ?? 'hoà'}
Tỉ số hiệp: ATOM ${wins?.p1 ?? 0} - ${wins?.p2 ?? 0} ZEUS
Số liệu ATOM: ${JSON.stringify(stats?.p1 ?? {})}
Số liệu ZEUS: ${JSON.stringify(stats?.p2 ?? {})}
(${STATS_LEGEND})`;
}

async function askClaude({ system, content, format }) {
  const msg = await (SUPPORTS_FALLBACK ? client.beta.messages : client.messages).create(
    {
      model: MODEL,
      ...(SUPPORTS_FALLBACK && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      max_tokens: 1024,
      output_config: { effort: 'low', ...(format && { format }) },
      system,
      messages: [{ role: 'user', content }],
    },
    { timeout: 8000, maxRetries: 0 },
  );
  if (msg.stop_reason === 'refusal') throw new Error('refusal');
  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();
  if (!text) throw new Error('empty response');
  return text;
}

function logError(route, err) {
  if (err instanceof Anthropic.APIConnectionError) console.error(`[${route}] không kết nối được API:`, err.message);
  else if (err instanceof Anthropic.APIError) console.error(`[${route}] API lỗi ${err.status}:`, err.message);
  else console.error(`[${route}]`, err.message);
}

app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true, model: MODEL }));

app.post(['/commentary', '/api/commentary'], async (req, res) => {
  if (!req.body?.stats) return res.status(400).json({ error: 'missing stats' });
  try {
    const text = await askClaude({ system: COMMENTARY_SYSTEM, content: describeRound(req.body) });
    res.json({ text });
  } catch (err) {
    logError('commentary', err);
    res.status(502).json({ error: 'commentary unavailable' });
  }
});

app.post(['/coach', '/api/coach'], async (req, res) => {
  if (!req.body?.stats) return res.status(400).json({ error: 'missing stats' });
  try {
    const raw = await askClaude({
      system: COACH_SYSTEM,
      content: describeRound(req.body),
      format: { type: 'json_schema', schema: COACH_SCHEMA },
    });
    const t = JSON.parse(raw);
    const ok =
      COACH_SCHEMA.properties.aggro.enum.includes(t.aggro) &&
      COACH_SCHEMA.properties.favor.enum.includes(t.favor) &&
      COACH_SCHEMA.properties.defense.enum.includes(t.defense) &&
      typeof t.quote === 'string';
    if (!ok) throw new Error(`invalid tactics: ${raw}`);
    res.json({ aggro: t.aggro, favor: t.favor, defense: t.defense, quote: t.quote.trim().slice(0, 120) });
  } catch (err) {
    logError('coach', err);
    res.status(502).json({ error: 'coach unavailable' });
  }
});

app.listen(PORT, () => console.log(`Commentary proxy: http://localhost:${PORT} (model ${MODEL})`));
