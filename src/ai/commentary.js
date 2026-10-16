// Bình luận viên giữa hiệp: đếm số liệu của hiệp, hết hiệp gửi lên server/ để Claude bình luận.
// Server lỗi hoặc chậm thì dùng câu soạn sẵn. Tự hiện banner riêng, không phụ thuộc HUD.
import { on, emit } from '../events.js';

const SERVER = import.meta.env?.VITE_COMMENTARY_URL ?? 'http://localhost:8787';
const TIMEOUT_MS = 4000;
const SHOW_MS = 6000;

const FALLBACK = {
  end: [
    'Hết hiệp! Hai robot vẫn đang so găng cực kỳ căng thẳng!',
    'Một hiệp đấu mãn nhãn, khán giả đứng ngồi không yên!',
    'Chuông vang lên! Hiệp sau chắc chắn sẽ còn nảy lửa hơn!',
  ],
  ko: [
    'K.O.! Một cú kết liễu không thể tin nổi!',
    'Đối thủ đã đo sàn! Trận đấu kết thúc trong bùng nổ!',
  ],
};

const blank = () => ({
  p1: { punches: 0, landed: 0, blocked: 0, damage: 0 },
  p2: { punches: 0, landed: 0, blocked: 0, damage: 0 },
});

let stats = blank();
let round = 1;
let hp = { p1: 100, p2: 100 };
let enabled = true;
let banner = null;
let hideTimer = null;

const other = (who) => (who === 'p1' ? 'p2' : 'p1');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function show(text) {
  emit('COMMENTARY', { text });
  if (typeof document === 'undefined') return;
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

async function fetchCommentary(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVER}/commentary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { text } = await res.json();
    if (!text) throw new Error('empty');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function onRoundOver(kind, winner, difficulty) {
  const payload = { round, kind, winner: winner ?? null, difficulty, hp, stats };
  let text;
  try {
    text = await fetchCommentary(payload);
  } catch (err) {
    console.warn('[commentary] dùng câu soạn sẵn:', err.message);
    text = pick(FALLBACK[kind]);
  }
  show(text);
}

export const getRoundStats = () => ({ round, hp, stats });
export const setCommentaryEnabled = (v) => (enabled = v);

export function startCommentary({ getDifficulty = () => 'normal' } = {}) {
  on('PUNCH', ({ who }) => stats[who] && stats[who].punches++);
  on('HIT', ({ target, damage, blocked }) => {
    const s = stats[other(target)];
    if (!s) return;
    if (blocked) s.blocked++;
    else s.landed++;
    s.damage += damage;
  });
  on('HP', (v) => (hp = { p1: Math.round(v.p1), p2: Math.round(v.p2) }));
  on('ROUND', ({ round: r, state, winner }) => {
    if (state === 'start') {
      if (r) round = r;
      stats = blank();
    } else if ((state === 'end' || state === 'ko') && enabled) {
      onRoundOver(state, winner, getDifficulty());
    }
  });
}
