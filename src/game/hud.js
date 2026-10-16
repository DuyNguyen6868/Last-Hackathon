// HUD (Duy): thanh máu, đồng hồ, banner hiệp, bình luận.
import { on } from '../events.js';
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
let bannerTimer;

function banner(text, ms = 1200) {
  const el = $('banner');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function renderWins(wins) {
  $('wins-p1').textContent = '🏆'.repeat(wins.p1);
  $('wins-p2').textContent = '🏆'.repeat(wins.p2);
}

export function initHud({ onMatchOver } = {}) {
  on('HP', ({ p1, p2 }) => {
    $('hp-p1').style.width = `${(p1 / CONFIG.maxHP) * 100}%`;
    $('hp-p2').style.width = `${(p2 / CONFIG.maxHP) * 100}%`;
  });

  on('TIMER', ({ seconds }) => {
    $('timer').textContent = seconds;
  });

  on('ROUND', ({ round, state, winner, wins }) => {
    $('round-label').textContent = `ROUND ${round}`;
    if (wins) renderWins(wins);
    if (state === 'countdown') {
      $('commentary').classList.add('hidden');
      banner(`ROUND ${round}`, 0);
    }
    if (state === 'fight') banner('FIGHT!', 900);
    if (state === 'ko') banner('K.O.!', 2500);
    if (state === 'end') banner(winner ? `${winner === 'p1' ? 'ATOM' : 'ZEUS'} THẮNG HIỆP` : 'HOÀ', 2500);
    if (state === 'over') {
      banner(winner === 'p1' ? 'BẠN THẮNG! 🏆' : winner === 'p2' ? 'BẠN THUA!' : 'HOÀ!', 0);
      onMatchOver?.(winner);
    }
  });

  on('COMMENTARY', ({ text }) => {
    const el = $('commentary');
    el.textContent = `🎙️ ${text}`;
    el.classList.remove('hidden');
  });
}

export function hideBanner() {
  $('banner').classList.remove('show');
}
