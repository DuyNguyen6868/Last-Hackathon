// Proxy gọi Claude (Tiến Anh). Giữ API key ở server, frontend chỉ gọi /api/commentary.
// Chạy: npm run server  (cần file .env, xem .env.example)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

const client = new Anthropic(); // đọc ANTHROPIC_API_KEY từ môi trường
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// Fallback phía server khi model từ chối trả lời: chỉ dùng với các model hỗ trợ
const SUPPORTS_FALLBACK = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'].includes(MODEL);

const SYSTEM = `Bạn là bình luận viên đấm bốc robot trong giải "Reel Steel", giọng hào hứng như truyền hình thể thao.
Robot của người chơi tên ATOM (p1, màu xanh), robot AI tên ZEUS (p2, màu đỏ).
Dựa trên số liệu hiệp đấu, viết đúng 1–2 câu tiếng Việt, tổng dưới 40 từ.
Nhắc tới ít nhất một con số cụ thể (số đòn trúng, máu còn lại...). Kết thúc bằng một lời khuyên chiến thuật ngắn cho ATOM nếu ATOM đang thua.
Chỉ trả về câu bình luận, không thêm tiêu đề hay ký hiệu.`;

app.post('/api/commentary', async (req, res) => {
  const { state, winner, stats, wins } = req.body ?? {};
  if (!stats) return res.status(400).json({ error: 'missing stats' });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      ...(SUPPORTS_FALLBACK && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Sự kiện: ${state === 'ko' ? 'KNOCKOUT' : state === 'over' ? 'KẾT THÚC TRẬN' : 'HẾT HIỆP'}
Người thắng: ${winner ?? 'hoà'}
Tỉ số hiệp: ATOM ${wins?.p1 ?? 0} - ${wins?.p2 ?? 0} ZEUS
Số liệu: ${JSON.stringify(stats)}
(thrown = số đòn tung ra, landed = trúng, blocked = bị đỡ, missed = bị né, combos = số combo trúng, counters = số lần phản đòn thành công, hp = máu còn lại /100)`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(502).json({ error: 'refusal' });
    }
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    res.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Sai hoặc thiếu ANTHROPIC_API_KEY');
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error('Bị giới hạn tốc độ, thử lại sau');
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Lỗi API ${error.status}:`, error.message);
    } else {
      console.error(error);
    }
    res.status(502).json({ error: 'llm_failed' });
  }
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`Commentary server: http://localhost:${port} (model ${MODEL})`));
