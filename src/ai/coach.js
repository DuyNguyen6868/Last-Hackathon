// Huấn luyện viên của ZEUS (ý tưởng từ llm-colosseum, xem REPOS.md): hết mỗi hiệp, Claude đọc số liệu
// và trả về chiến thuật JSON cho hiệp sau. Server lỗi thì dùng luật đơn giản trên cùng số liệu.
// Chiến thuật được áp qua applyTactics() nên luôn nằm trong giới hạn của mức khó đang chọn.
import { on } from '../events.js';
import { CONFIG } from '../config.js';
import { applyTactics } from './opponent.js';
import { say } from './taunt.js';
import { postJson } from './api.js';

const QUOTES = {
  hook: ['Nó thủ kín quá, móc hook vòng qua găng!', 'Đừng đấm thẳng nữa, đánh vòng vào sườn!'],
  jab: ['Nó né giỏi đấy, jab nhanh và ngắn thôi!', 'Đừng vung tay rộng, jab liên tục vào!'],
  guard: ['Giơ găng lên! Đừng ăn đòn miễn phí nữa!', 'Thủ chặt vào, chờ nó hớ rồi mới đánh!'],
  up: ['Dồn lên! Không còn đường lùi nữa đâu!', 'Ép sát nó! Đừng cho nó thở!'],
  same: ['Giữ nhịp như vậy, chờ nó sơ hở!', 'Tốt lắm, cứ thế mà đánh!'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rate = (a, b) => a / Math.max(1, b);

// Phương án dự phòng: đọc số liệu hiệp (stats từ game.js) và chọn chiến thuật bằng luật
export function ruleTactics(stats, wins) {
  const atom = stats?.p1 ?? {};
  const zeus = stats?.p2 ?? {};
  const favor =
    rate(zeus.blocked, zeus.thrown) > 0.3 ? 'hook' : rate(zeus.missed, zeus.thrown) > 0.3 ? 'jab' : 'mixed';
  const defense = rate(atom.landed, atom.thrown) > 0.5 ? 'guard' : 'balanced';
  const aggro = (wins?.p2 ?? 0) < (wins?.p1 ?? 0) ? 'up' : (zeus.hp ?? 100) < (atom.hp ?? 100) - 25 ? 'down' : 'same';
  const quote = pick(
    favor !== 'mixed' ? QUOTES[favor] : defense === 'guard' ? QUOTES.guard : aggro === 'up' ? QUOTES.up : QUOTES.same,
  );
  return { aggro, favor, defense, quote };
}

// Trận đã kết thúc thì không cần chiến thuật cho hiệp sau (K.O. luôn kết thúc trận trong game.js)
function matchOver(state, round, wins) {
  const majority = Math.floor(CONFIG.rounds / 2) + 1;
  return state === 'ko' || round >= CONFIG.rounds || wins?.p1 >= majority || wins?.p2 >= majority;
}

export function startCoach({ getDifficulty }) {
  on('ROUND', async ({ round, state, winner, stats, wins }) => {
    if (state !== 'end' && state !== 'ko') return;
    if (matchOver(state, round, wins)) return;
    let tactics;
    let source = 'Claude';
    try {
      tactics = await postJson('/coach', { state, round, winner, stats, wins, difficulty: getDifficulty() });
    } catch (err) {
      tactics = ruleTactics(stats, wins);
      source = `luật (${err.message})`;
    }
    applyTactics(tactics);
    console.info(`[coach] chiến thuật hiệp ${round + 1} từ ${source}:`, tactics);
    say('p2', `HLV: ${tactics.quote}`, '📋');
  });
}
