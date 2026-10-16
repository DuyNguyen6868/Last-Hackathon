// Điểm vào (Duy): khởi tạo và nối các module. Các module chỉ nói chuyện qua events.js.
import './style.css';
import { createScene } from './render/scene.js';
import { initSfx, unlockAudio } from './render/sfx.js';
import { initKeyboard } from './input/keyboard.js';
import { game, startMatch, updateGame } from './game/game.js';
import { initHud, hideBanner } from './game/hud.js';
import { createOpponent } from './ai/opponent.js';
import { initCommentary } from './ai/commentary.js';
import { startVision } from './vision/pose.js';

const $ = (id) => document.getElementById(id);

const scene = createScene($('arena'));
const opponent = createOpponent();
let visionSession = null;
initSfx();
initKeyboard();
initCommentary();
initHud({
  onMatchOver: () => {
    setTimeout(() => {
      $('btn-start').textContent = '🔁 Đấu lại';
      $('menu').classList.remove('hidden');
    }, 3500);
  },
});

// Menu
$('btn-start').addEventListener('click', () => {
  unlockAudio();
  opponent.setLevel($('difficulty').value);
  $('menu').classList.add('hidden');
  hideBanner();
  startMatch();
});

$('btn-cam').addEventListener('click', async () => {
  const btn = $('btn-cam');
  btn.disabled = true;
  $('cam').classList.remove('hidden');
  try {
    visionSession = await startVision({
      video: $('cam-video'), canvas: $('cam-canvas'), debugEl: $('cam-debug'),
      onStatus: (s) => ($('cam-status').textContent = s),
    });
    btn.textContent = '📷 Webcam đang bật';
  } catch (err) {
    console.error(err);
    $('cam-status').textContent = `Không bật được webcam (${err.message}). Vẫn chơi được bằng bàn phím.`;
    $('cam').classList.add('hidden');
    btn.disabled = false;
  }
});

$('btn-calibrate').addEventListener('click', () => {
  if (!visionSession) return;
  visionSession.detector.recalibrate();
  $('cam-status').textContent = 'Đang hiệu chỉnh: đứng thẳng, nhìn về camera và giữ yên một chút.';
});

// Vòng lặp chính
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateGame(dt);
  opponent.update(dt, now);
  scene.update(dt, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Cho phép debug trong console: game.f.p1.hp = 1
window.game = game;

// Mở http://localhost:5173/?autostart để vào trận ngay, khỏi bấm menu khi dev
if (new URLSearchParams(location.search).has('autostart')) $('btn-start').click();
