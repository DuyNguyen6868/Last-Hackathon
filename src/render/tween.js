// Tween tối giản: mỗi (target, prop) có tối đa một "track" gồm nhiều keyframe nối tiếp.
// key = { to, dur, ease }  ·  bỏ `to` để giữ nguyên giá trị hiện tại (dùng làm khoảng chờ).

const EASE = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export class Tweens {
  constructor() {
    this.tracks = [];
  }

  // Thay thế track đang chạy trên cùng (target, prop)
  track(target, prop, keys) {
    this.tracks = this.tracks.filter((tr) => !(tr.target === target && tr.prop === prop));
    this.tracks.push({ target, prop, keys, i: 0, t: 0, from: target[prop] });
  }

  cancelTargets(targets) {
    this.tracks = this.tracks.filter((tr) => !targets.has(tr.target));
  }

  update(dt) {
    for (const tr of this.tracks) {
      tr.t += dt;
      for (;;) {
        const key = tr.keys[tr.i];
        if (!key) break;
        const to = key.to === undefined ? tr.from : key.to;
        const dur = Math.max(1, key.dur);
        if (tr.t >= dur) {
          tr.target[tr.prop] = to;
          tr.t -= dur;
          tr.from = to;
          tr.i++;
        } else {
          const e = (EASE[key.ease] || EASE.linear)(tr.t / dur);
          tr.target[tr.prop] = tr.from + (to - tr.from) * e;
          break;
        }
      }
    }
    this.tracks = this.tracks.filter((tr) => tr.i < tr.keys.length);
  }
}
