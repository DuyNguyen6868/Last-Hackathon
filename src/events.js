// Event bus dùng chung. Mọi module chỉ giao tiếp qua đây (xem HUONG_DAN.md mục 5).
const handlers = {};

export function on(type, fn) {
  (handlers[type] ??= []).push(fn);
  return () => off(type, fn);
}

export function off(type, fn) {
  handlers[type] = (handlers[type] || []).filter((h) => h !== fn);
}

export function emit(type, payload = {}) {
  if (globalThis.DEBUG_EVENTS) console.log('[event]', type, payload);
  (handlers[type] || []).forEach((fn) => fn(payload));
}

// Gõ `DEBUG_EVENTS = true` trong console trình duyệt để log mọi event
globalThis.DEBUG_EVENTS = false;
