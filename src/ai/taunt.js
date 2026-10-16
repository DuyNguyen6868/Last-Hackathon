// Lời thoại của robot đỏ: khiêu khích đầu hiệp, ăn mừng khi thắng, cay cú khi thua. Hiện bong bóng thoại riêng.
// Cũng phát TAUNT { who, line } để HUD/render dùng nếu muốn.
import { emit } from '../events.js';

const SHOW_MS = 2500;

const LINES = {
  first: [
    'Lại đây nào, con người!',
    'Webcam bật chưa đấy? Tôi chưa thấy cú đấm nào cả!',
    'Tôi được train cả triệu hiệp rồi. Còn bạn?',
    'Đấm thử xem, tôi đứng yên cho!',
  ],
  ahead: [
    'Vẫn còn đứng được à? Bất ngờ đấy!',
    'Hiệp này kết thúc nhanh thôi.',
    'Thêm vài cú nữa là xong, chuẩn bị nằm sàn nhé!',
  ],
  behind: [
    'Vừa rồi chỉ là khởi động thôi.',
    'Giờ mới bắt đầu nghiêm túc!',
    'Hết pin dự phòng rồi, giờ dùng pin chính!',
  ],
  even: [
    'Ngang tài ngang sức à? Để xem hiệp này!',
    'Không tệ… với một con người.',
  ],
  interrupted: ['Ê! Chưa nói xong mà!', 'Chơi xấu thế!', 'Đánh lén à?!'],
  win: [
    'Con người 0 – Robot 1!',
    'Đã cập nhật dữ liệu: nhân loại quá dễ!',
    'GG! Lần sau nhớ khởi động kỹ hơn nhé!',
    'Ai là nhà vô địch? Tôi! Là tôi đây!',
  ],
  lose: [
    'Lỗi 404: không tìm thấy chiến thắng…',
    'Không công bằng… webcam bị lag!',
    'Tôi… sẽ… quay… lại…',
    'Đang khởi động lại… lần sau sẽ khác!',
  ],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let bubble = null;
let hideTimer = null;

// wins: số hiệp đã thắng (game.js gửi kèm ROUND). Không có thì so máu.
export function tauntLine({ round, hp, wins }) {
  if (!round || round <= 1) return pick(LINES.first);
  const lead = wins ? wins.p2 - wins.p1 : (hp.p2 - hp.p1) / 10;
  if (lead >= 1) return pick(LINES.ahead);
  if (lead <= -1) return pick(LINES.behind);
  return pick(LINES.even);
}

export const interruptedLine = () => pick(LINES.interrupted);
export const winLine = () => pick(LINES.win);
export const loseLine = () => pick(LINES.lose);

export function say(who, line, icon = '🤖') {
  emit('TAUNT', { who, line });
  if (typeof document === 'undefined') return;
  if (!bubble) {
    bubble = document.createElement('div');
    Object.assign(bubble.style, {
      position: 'fixed', left: '50%', top: '16%', transform: 'translateX(-50%)',
      maxWidth: 'min(520px, 85vw)', padding: '10px 18px', borderRadius: '16px',
      background: 'rgba(40, 6, 6, 0.85)', color: '#fff', border: '2px solid #ff3b3b',
      font: '700 22px/1.35 system-ui, sans-serif', textAlign: 'center', zIndex: 1000,
      pointerEvents: 'none', transition: 'opacity 0.25s', opacity: '0',
    });
    document.body.appendChild(bubble);
  }
  bubble.textContent = `${icon} ${line}`;
  bubble.style.opacity = '1';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => (bubble.style.opacity = '0'), SHOW_MS);
}
