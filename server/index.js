// Proxy nhỏ gọi Claude để bình luận giữa hiệp. API key chỉ nằm trong server/.env.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
const MODEL = 'claude-haiku-5-5';

const SYSTEM = `Bạn là bình luận viên quyền anh robot trên truyền hình, giọng hào hứng, kịch tính.
Trận đấu: người chơi thật (p1, robot XANH) điều khiển bằng cách đấm trước webcam, đấu với robot ĐỎ do AI điều khiển (p2).
Nhận số liệu của hiệp vừa xong, viết đúng 1–2 câu bình luận tiếng Việt, tối đa 40 từ.
Nhắc tới con số nổi bật nhất (số đòn trúng, máu còn lại...). Không dùng markdown, không dùng dấu ngoặc kép, chỉ trả về câu bình luận.`;

const client = new Anthropic();
const app = express();
app.use(cors());
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/commentary', async (req, res) => {
  const { round, kind, winner, difficulty, hp, stats } = req.body ?? {};
  const summary = JSON.stringify({ round, kind, winner, difficulty, hp, stats });
  try {
    const msg = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content: `Số liệu hiệp (kind="ko" nghĩa là vừa có K.O.):\n${summary}` }],
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
    res.json({ text });
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionError) console.error('[commentary] không kết nối được API:', err.message);
    else if (err instanceof Anthropic.APIError) console.error(`[commentary] API lỗi ${err.status}:`, err.message);
    else console.error('[commentary]', err.message);
    res.status(502).json({ error: 'commentary unavailable' });
  }
});

app.listen(PORT, () => console.log(`Commentary proxy: http://localhost:${PORT}`));
