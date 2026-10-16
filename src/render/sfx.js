// Lớp tương thích với src/main.js của Duy. Âm thanh thật do audio.js phát,
// và index.js đã nghe HIT/ANIM/ROUND nên initSfx() không đăng ký thêm (tránh phát đôi).
export { unlockAudio } from './audio.js';

export function initSfx() {}
