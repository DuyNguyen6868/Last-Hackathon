// Điểm vào thay thế cho phần AI (main.js hiện dùng thẳng createOpponent() và initCommentary()).
// Mức khó lấy từ URL (?diff=easy|normal|hard), mặc định normal. Thêm ?aidebug để log FSM ra console.
// Hướng né: ?dodge=opposite|same (xem DODGE_MAPS trong opponent.js), mặc định opposite.
// AI chỉ bắt đầu khi nhận ROUND { round, state: 'start' }: khiêu khích ~1s rồi mới vào đánh.
import { startOpponent, setDifficulty, getDifficulty, setDodgeMap } from './opponent.js';
import { startCommentary } from './commentary.js';

export { setDifficulty, getDifficulty, setDodgeMap };

export function initAI({ difficulty, debug, dodgeMap, taunt = true, commentary = true } = {}) {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  startOpponent({
    difficulty: difficulty ?? params.get('diff') ?? 'normal',
    debug: debug ?? params.has('aidebug'),
    dodgeMap: dodgeMap ?? params.get('dodge') ?? undefined,
    taunt,
  });
  if (commentary) startCommentary({ getDifficulty });
}
