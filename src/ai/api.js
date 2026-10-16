// Gọi server/ (proxy Claude). Mặc định đi qua /api của Vite proxy (vite.config.js);
// đặt VITE_COMMENTARY_URL để trỏ tới server khác, ví dụ http://localhost:8787.
export const API_BASE = import.meta.env?.VITE_COMMENTARY_URL ?? '/api';
const TIMEOUT_MS = 5000; // nghỉ giữa hiệp chỉ 6 giây (CONFIG.betweenRoundsMs)

// POST JSON, quá TIMEOUT_MS thì huỷ. Lỗi mạng / HTTP đều ném lỗi để bên gọi dùng phương án dự phòng.
export async function postJson(path, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
