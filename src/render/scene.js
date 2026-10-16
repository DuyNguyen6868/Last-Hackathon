// Lớp tương thích với src/main.js của Duy: createScene(container) -> { update, robots }.
// Phần dựng đấu trường thật nằm trong stage.js, vòng lặp render nằm trong index.js.
import { on, emit } from '../events.js';
import { initRender } from './index.js';

export function createScene(container) {
  const r = initRender({ container, bus: { on, emit } });
  // index.js tự chạy vòng lặp render (setAnimationLoop) nên update() không cần làm gì.
  return { update() {}, robots: r.robots, render: r };
}
