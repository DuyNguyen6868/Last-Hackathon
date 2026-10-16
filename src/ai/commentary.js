// Bình luận viên (Tiến Anh): gọi server /api/commentary sau mỗi hiệp, lỗi thì dùng câu soạn sẵn.
import { on, emit } from '../events.js';

const FALLBACK = {
  p1: [
    'ATOM đang làm chủ võ đài! Những cú đấm chính xác khiến ZEUS lúng túng!',
    'Một hiệp tuyệt vời của ATOM, khán giả đang đứng hết dậy!',
  ],
  p2: [
    'ZEUS quá lạnh lùng! ATOM cần thay đổi chiến thuật ngay!',
    'Hiệp này thuộc về ZEUS, ATOM phải giữ guard cao hơn!',
  ],
  none: ['Một hiệp cân tài cân sức! Mọi thứ vẫn còn bỏ ngỏ!'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function fetchCommentary(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('/api/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { text } = await res.json();
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function initCommentary() {
  on('ROUND', async ({ state, winner, stats, wins }) => {
    // Mỗi hiệp gọi một lần (hết giờ hoặc KO). 'over' theo ngay sau nên bỏ qua để khỏi gọi trùng
    if (state !== 'end' && state !== 'ko') return;
    try {
      const text = await fetchCommentary({ state, winner, stats, wins });
      emit('COMMENTARY', { text });
    } catch {
      emit('COMMENTARY', { text: pick(FALLBACK[winner ?? 'none']) });
    }
  });
}
