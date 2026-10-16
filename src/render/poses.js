// Dữ liệu tư thế thuần túy (không phụ thuộc three).
// Mọi robot đều có cùng các "kênh" khớp; mỗi tư thế là một bảng kênh -> giá trị.
// Hệ trục cục bộ của robot: nhìn về +z, trái của robot là +x, lên là +y.

export const CHANNELS = [
  'bodyX', 'bodyY', 'bodyZ',   // dịch chuyển cả thân (né, lao tới)
  'bodyRx', 'bodyRz',          // nghiêng cả thân quanh bàn chân (trúng đòn, né, ngã)
  'twist',                     // xoay thân quanh trục Y (hook)
  'headX', 'headY',            // đầu
  'shLx', 'shLz', 'elL',       // vai trái (tiến/ra ngoài), khuỷu trái
  'shRx', 'shRz', 'elR',       // vai phải, khuỷu phải
  'spineX',                    // gập/ngả thân trên quanh eo (+ = cúi tới trước)
  'hipL', 'kneeL', 'hipR', 'kneeR', // hông (âm = đùi đưa ra trước) và gối (dương = gập)
];

const common = { bodyX: 0, bodyY: 0, bodyZ: 0, bodyRx: 0, bodyRz: 0, twist: 0, headX: 0, headY: 0 };

export const BASE = {
  idle: {
    ...common,
    shLx: -0.4, shLz: 0.14, elL: -0.7,
    shRx: -0.4, shRz: -0.14, elR: -0.7,
    spineX: 0.04,
    hipL: -0.2, kneeL: 0.4, hipR: -0.12, kneeR: 0.32,
  },
  guard: {
    ...common,
    headX: 0.15,
    shLx: -0.85, shLz: -0.18, elL: -1.75,
    shRx: -0.85, shRz: 0.18, elR: -1.75,
    spineX: 0.14,
    hipL: -0.3, kneeL: 0.55, hipR: -0.2, kneeR: 0.45,
  },
};

// Lật trái <-> phải cho một cặp (kênh, giá trị)
const PAIRS = { shLx: 'shRx', elL: 'elR', hipL: 'hipR', kneeL: 'kneeR' };
const PAIRS_BACK = Object.fromEntries(Object.entries(PAIRS).map(([a, b]) => [b, a]));

export function mirrorEntry(key, v) {
  if (PAIRS[key]) return [PAIRS[key], v];
  if (PAIRS_BACK[key]) return [PAIRS_BACK[key], v];
  if (key === 'shLz') return ['shRz', -v];
  if (key === 'shRz') return ['shLz', -v];
  if (key === 'twist' || key === 'bodyX' || key === 'bodyRz' || key === 'headY') return [key, -v];
  return [key, v];
}

export function mirrorPose(pose) {
  const out = {};
  for (const [k, v] of Object.entries(pose)) {
    const [k2, v2] = mirrorEntry(k, v);
    out[k2] = v2;
  }
  return out;
}
