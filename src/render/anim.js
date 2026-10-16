import { BASE, CHANNELS, mirrorPose } from './poses.js';

// peak: tư thế đỉnh của đòn · out/hold/back: ms đưa ra / giữ / thu về
const JAB_L = {
  peak: { shLx: -1.52, shLz: -0.04, elL: -0.08, twist: -0.3, bodyZ: 0.4, headX: 0.05, spineX: 0.12, hipL: -0.55, kneeL: 0.85, hipR: 0.08, kneeR: 0.2 },
  out: 110, hold: 50, back: 190,
};
const HOOK_L = {
  peak: { shLx: -0.15, shLz: 1.4, elL: -2.0, twist: -0.85, bodyZ: 0.18, hipL: -0.35, kneeL: 0.65, hipR: 0.0, kneeR: 0.25 },
  out: 170, hold: 60, back: 240,
};
const DODGE_L = {
  peak: { bodyX: 0.55, bodyRz: -0.28, spineX: 0.22, hipL: -0.55, kneeL: 1.0, hipR: -0.5, kneeR: 0.95 },
  out: 110, hold: 650, back: 220,
};
const HIT = {
  peak: { bodyRx: -0.2, bodyZ: -0.15, headX: -0.45, twist: 0.15, spineX: -0.22, hipL: -0.05, kneeL: 0.25, hipR: 0.05, kneeR: 0.2 },
  out: 70, hold: 60, back: 280,
};
const KO = {
  peak: {
    bodyRx: -1.45, bodyY: 0.14, bodyZ: -0.7, headX: -0.4, twist: 0.2,
    shLx: -0.1, shLz: 1.0, elL: -0.3, shRx: -0.1, shRz: -1.0, elR: -0.3,
    spineX: -0.25, hipL: -0.1, kneeL: 0.9, hipR: 0.25, kneeR: 0.35,
  },
  out: 700, hold: 0, back: 0,
};

const SPECS = {
  jab_L: JAB_L,
  jab_R: { ...JAB_L, peak: mirrorPose(JAB_L.peak) },
  hook_L: HOOK_L,
  hook_R: { ...HOOK_L, peak: mirrorPose(HOOK_L.peak) },
  dodge_L: DODGE_L,
  dodge_R: { ...DODGE_L, peak: mirrorPose(DODGE_L.peak) },
  hit: HIT,
};

// Đưa tất cả kênh về một tư thế
function goto(robot, tw, pose, dur, ease = 'inOutQuad') {
  for (const ch of CHANNELS) {
    const [obj, key] = robot.channels[ch];
    tw.track(obj, key, [{ to: pose[ch], dur, ease }]);
  }
}

// Đi tới đỉnh, giữ, rồi quay về tư thế nền (idle hoặc guard)
function strike(robot, tw, spec) {
  const base = BASE[robot.base];
  for (const ch of CHANNELS) {
    const [obj, key] = robot.channels[ch];
    if (ch in spec.peak) {
      tw.track(obj, key, [
        { to: spec.peak[ch], dur: spec.out, ease: 'outCubic' },
        { dur: spec.hold },
        { to: base[ch], dur: spec.back, ease: 'inOutQuad' },
      ]);
    } else {
      tw.track(obj, key, [{ to: base[ch], dur: 150, ease: 'outQuad' }]);
    }
  }
}

// Phát một animation theo tên trong contract (xem HUONG_DAN.md mục 5)
export function playAnim(robot, name, tw) {
  if (name === 'reset') {
    // Game phát 'reset' đầu mỗi hiệp: đứng dậy, về tư thế nền
    tw.cancelTargets(robot.targets);
    robot.reset();
    return;
  }
  if (robot.ko) return; // đã KO: chỉ reset() mới đứng dậy được

  if (name === 'idle') {
    robot.base = 'idle';
    goto(robot, tw, BASE.idle, 200);
  } else if (name === 'guard') {
    robot.base = 'guard';
    goto(robot, tw, BASE.guard, 140);
  } else if (name === 'ko') {
    robot.ko = true;
    for (const ch of CHANNELS) {
      const [obj, key] = robot.channels[ch];
      tw.track(obj, key, [{ to: KO.peak[ch] ?? BASE.idle[ch], dur: KO.out, ease: 'inQuad' }]);
    }
    tw.track(robot, 'power', [{ to: 0, dur: 500, ease: 'outQuad' }]);
  } else if (SPECS[name]) {
    strike(robot, tw, SPECS[name]);
  } else {
    console.warn(`[render] ANIM không hỗ trợ: "${name}"`);
  }
}
