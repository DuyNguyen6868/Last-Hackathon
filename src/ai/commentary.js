// Bình luận viên giữa hiệp: hết hiệp gửi số liệu thật của game.js lên server/ để Claude bình luận.
// Server lỗi hoặc chậm thì dùng câu soạn sẵn. HUD của Duy hiện COMMENTARY; không có HUD thì tự hiện banner.
// Cũng khởi động huấn luyện viên của ZEUS (coach.js) để main.js chỉ cần gọi initCommentary().
import { on, emit } from '../events.js';
import { getDifficulty as aiDifficulty } from './opponent.js';
import { startCoach } from './coach.js';
import { postJson } from './api.js';

const SHOW_MS = 6000;

const FALLBACK = {
  p1: [
    'ATOM làm chủ võ đài! Những cú đấm chính xác khiến ZEUS lúng túng!',
    'Một hiệp tuyệt vời của ATOM, khán giả đang đứng hết dậy!',
  ],
  p2: [
    'ZEUS quá lạnh lùng! ATOM cần giữ găng cao hơn ở hiệp sau!',
    'Hiệp này thuộc về ZEUS. ATOM ơi, đấm xong nhớ thu tay về!',
  ],
  none: ['Một hiệp cân tài cân sức! Mọi thứ vẫn còn bỏ ngỏ!'],
  ko: {
    p1: ['K.O.! ATOM hạ gục cỗ máy ZEUS! Con người chiến thắng!'],
    p2: ['K.O.! ZEUS kết liễu ATOM bằng một đòn lạnh lùng!'],
  },
};

let enabled = true;
let banner = null;
let hideTimer = null;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function show(text) {
  emit('COMMENTARY', { text });
  if (typeof document === 'undefined') return;
  if (document.getElementById('commentary')) return; // HUD của Duy đã hiện COMMENTARY, không hiện trùng
  if (!banner) {
    banner = document.createElement('div');
    Object.assign(banner.style, {
      position: 'fixed', left: '50%', bottom: '8%', transform: 'translateX(-50%)',
      maxWidth: 'min(720px, 90vw)', padding: '14px 22px', borderRadius: '12px',
      background: 'rgba(10, 12, 20, 0.85)', color: '#ffe27a', border: '2px solid #ffb800',
      font: '600 20px/1.4 system-ui, sans-serif', textAlign: 'center', zIndex: 1000,
      pointerEvents: 'none', transition: 'opacity 0.3s', opacity: '0',
    });
    document.body.appendChild(banner);
  }
  banner.textContent = `🎙️ ${text}`;
  banner.style.opacity = '1';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => (banner.style.opacity = '0'), SHOW_MS);
}

function fallbackLine(state, winner) {
  if (state === 'ko' && FALLBACK.ko[winner]) return pick(FALLBACK.ko[winner]);
  return pick(FALLBACK[winner] ?? FALLBACK.none);
}

export const setCommentaryEnabled = (v) => (enabled = v);

export function startCommentary({ getDifficulty = aiDifficulty } = {}) {
  // game.js gửi kèm stats ({ round, p1: { hp, thrown, landed, blocked, missed }, p2 }) và wins
  on('ROUND', async ({ round, state, winner, stats, wins }) => {
    // Mỗi hiệp gọi một lần (hết giờ hoặc K.O.). 'over' theo ngay sau nên bỏ qua để khỏi gọi trùng
    if ((state !== 'end' && state !== 'ko') || !enabled) return;
    let text;
    try {
      ({ text } = await postJson('/commentary', { state, round, winner, stats, wins, difficulty: getDifficulty() }));
      if (!text) throw new Error('empty');
    } catch (err) {
      console.warn('[commentary] dùng câu soạn sẵn:', err.message);
      text = fallbackLine(state, winner);
    }
    show(text);
  });
  startCoach({ getDifficulty });
}

// main.js gọi initCommentary()
export const initCommentary = () => startCommentary();
