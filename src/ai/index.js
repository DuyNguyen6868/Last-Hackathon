// Điểm vào duy nhất của phần AI. Trong main.js: import { initAI } from './ai/index.js'; initAI();
// Mức khó lấy từ URL (?diff=easy|normal|hard), mặc định normal. Thêm ?aidebug để log FSM ra console.
// AI chỉ bắt đầu đánh khi nhận ROUND { state: 'start' }.
import { startOpponent, setDifficulty, getDifficulty } from './opponent.js';
import { startCommentary } from './commentary.js';

export { setDifficulty, getDifficulty };

export function initAI({ difficulty, debug, commentary = true } = {}) {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  startOpponent({
    difficulty: difficulty ?? params.get('diff') ?? 'normal',
    debug: debug ?? params.has('aidebug'),
  });
  if (commentary) startCommentary({ getDifficulty });
}
