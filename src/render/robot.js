import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BASE } from './poses.js';

// Hai robot lấy cảm hứng từ phim Real Steel:
//   p1 = ATOM: khung thép xám bạc gọn gàng, mắt xanh, ngực đen có đèn nhỏ.
//   p2 = ZEUS: khối đen to, vai gai, đầu thấp, ngực có khe sáng xanh lá, mắt đỏ.
// glow = màu mắt/viền sáng (cũng là màu tia lửa), accent = đèn phụ.
export const PALETTES = {
  p1: { body: 0x9aa4b4, trim: 0x3b4452, dark: 0x14171d, glow: 0x35c8ff, accent: 0xff7a2a },
  p2: { body: 0x3a3d48, trim: 0x6d7482, dark: 0x0c0d11, glow: 0xff2a3d, accent: 0x35ff7a },
};

// Kích thước từng nhân vật (đơn vị mét, robot cao khoảng 2.5)
const SPECS = {
  p1: { scale: 1, leg: 1, chestW: 1.2, chestH: 0.85, chestD: 0.62, shoulderX: 0.8, padW: 0.36, padH: 0.3, padD: 0.5, armR: 0.12, fist: 0.4, legX: 0.3, legW: 0.34, legD: 0.38, headW: 0.46, headH: 0.42, headD: 0.46, headZ: 0 },
  p2: { scale: 1.08, leg: 1.2, chestW: 1.62, chestH: 1.0, chestD: 0.84, shoulderX: 1.06, padW: 0.62, padH: 0.52, padD: 0.82, armR: 0.17, fist: 0.52, legX: 0.4, legW: 0.46, legD: 0.48, headW: 0.52, headH: 0.4, headD: 0.54, headZ: 0.12 },
};

// Chân: đùi và cẳng chân dài bằng nhau. Hông cách mắt cá 1.0, mắt cá cách sàn 0.1.
const THIGH = 0.5;
const SHIN = 0.5;
const ANKLE_Y = 0.1;

export function createRobot(id) {
  const pal = PALETTES[id];
  const sp = SPECS[id];
  const thigh = THIGH * sp.leg;
  const shin = SHIN * sp.leg;
  const hipY = ANKLE_Y + thigh + shin;
  const glowMats = [];

  const metal = (color, rough = 0.4, metalness = 0.6) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness });
  const body = metal(pal.body, 0.38, 0.7);
  const trim = metal(pal.trim, 0.35, 0.75);
  const dark = metal(pal.dark, 0.5, 0.8);
  const glow = (color, intensity = 2.4) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });
    m.userData = { baseI: intensity, base: new THREE.Color(color) };
    glowMats.push(m);
    return m;
  };
  const eyeMat = glow(pal.glow, 2.6);
  const accentMat = glow(id === 'p2' ? pal.accent : pal.accent, id === 'p2' ? 2.2 : 1.6);
  const rimMat = glow(pal.glow, 1.3);

  const rbox = (w, h, d, mat, x = 0, y = 0, z = 0, parent, r = 0.04) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent?.add(m);
    return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 14) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent?.add(m);
    return m;
  };
  const ball = (r, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent?.add(m);
    return m;
  };

  const group = new THREE.Group(); // đặt vị trí và hướng nhìn ngoài scene
  const bob = new THREE.Group(); // nhún nhảy kiểu võ sĩ
  const ground = new THREE.Group(); // tự hạ thân khi gập gối để bàn chân luôn chạm sàn
  const root = new THREE.Group(); // nhận các kênh bodyX/Y/Z/Rx/Rz
  group.add(bob);
  bob.add(ground);
  ground.add(root);
  group.scale.setScalar(sp.scale);

  // ---------- Chân: hông -> đùi -> gối -> cẳng chân -> mắt cá -> bàn chân ----------
  const legs = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const hip = new THREE.Group();
    hip.position.set(s * sp.legX, hipY, s > 0 ? 0.14 : -0.08); // chân trái đứng trước như võ sĩ
    root.add(hip);
    ball(sp.legW * 0.5, trim, 0, 0, 0, hip);
    rbox(sp.legW, thigh * 0.95, sp.legD, body, 0, -thigh * 0.5, 0, hip, 0.06);
    rbox(sp.legW * 0.8, 0.12, 0.05, accentMat, 0, -0.14, sp.legD * 0.5 + 0.01, hip, 0.01);

    const knee = new THREE.Group();
    knee.position.y = -thigh;
    hip.add(knee);
    ball(sp.legW * 0.46, trim, 0, 0, 0.02, knee);
    rbox(sp.legW * 0.7, 0.16, 0.14, trim, 0, 0.02, sp.legD * 0.5, knee, 0.05); // nắp gối
    rbox(sp.legW * 0.82, shin * 0.92, sp.legD * 0.88, dark, 0, -shin * 0.5, 0, knee, 0.05);
    rbox(sp.legW * 0.9, shin * 0.5, 0.06, trim, 0, -shin * 0.42, sp.legD * 0.44 + 0.02, knee, 0.03); // giáp cẳng chân

    const foot = new THREE.Group();
    foot.position.y = -shin;
    knee.add(foot);
    rbox(sp.legW + 0.08, 0.13, 0.72, trim, 0, -0.04, 0.14, foot, 0.05);
    rbox(sp.legW + 0.02, 0.07, 0.28, body, 0, 0.04, 0.24, foot, 0.03);
    legs[side] = { hip, knee, foot };
  }

  // ---------- Hông ----------
  rbox(sp.legX * 2 + sp.legW * 0.6, 0.3, 0.55, trim, 0, hipY + 0.05, 0, root, 0.06);
  rbox(sp.legX * 2 + sp.legW * 0.62, 0.04, 0.57, rimMat, 0, hipY + 0.2, 0, root, 0.01);

  // ---------- Thân trên (xoay ở eo) ----------
  const waist = hipY + 0.1;
  const torso = new THREE.Group();
  torso.position.set(0, waist, 0);
  root.add(torso);

  // Bụng: các tấm giáp xếp lớp
  rbox(sp.chestW * 0.6, 0.42, sp.chestD * 0.7, dark, 0, 0.2, 0, torso, 0.05);
  for (let i = 0; i < 3; i++) rbox(sp.chestW * 0.5, 0.07, sp.chestD * 0.78, trim, 0, 0.1 + i * 0.12, 0, torso, 0.02);

  const chestTop = 0.4 + sp.chestH;
  rbox(sp.chestW, sp.chestH, sp.chestD, body, 0, 0.4 + sp.chestH / 2, 0, torso, 0.08);
  rbox(sp.chestW * 0.72, sp.chestH * 0.6, 0.07, id === 'p1' ? dark : trim, 0, 0.4 + sp.chestH * 0.55, sp.chestD / 2 + 0.01, torso, 0.04);
  rbox(sp.chestW * 0.9, sp.chestH * 0.6, 0.2, dark, 0, 0.4 + sp.chestH * 0.55, -sp.chestD / 2 - 0.08, torso, 0.05); // ba lô sau lưng
  rbox(0.3, 0.14, 0.3, dark, 0, chestTop + 0.04, 0, torso, 0.03); // cổ

  if (id === 'p1') {
    // Atom: lõi sáng và 3 đèn nhỏ trên tấm ngực đen
    const core = cyl(0.12, 0.12, 0.05, eyeMat, 0, 0.4 + sp.chestH * 0.62, sp.chestD / 2 + 0.06, torso, 20);
    core.rotation.x = Math.PI / 2;
    for (let i = -1; i <= 1; i++) rbox(0.07, 0.05, 0.03, accentMat, i * 0.16, 0.4 + sp.chestH * 0.38, sp.chestD / 2 + 0.06, torso, 0.01);
  } else {
    // Zeus: 3 khe sáng xanh lá đứng trên ngực, hai tấm giáp ngực vát
    for (let i = -1; i <= 1; i++) rbox(0.07, sp.chestH * 0.5, 0.04, accentMat, i * 0.22, 0.4 + sp.chestH * 0.58, sp.chestD / 2 + 0.06, torso, 0.01);
    for (const s of [1, -1]) {
      const plate = rbox(sp.chestW * 0.34, sp.chestH * 0.3, 0.12, trim, s * sp.chestW * 0.3, chestTop - 0.12, sp.chestD / 2 - 0.02, torso, 0.04);
      plate.rotation.z = -s * 0.35;
    }
  }

  const chestAnchor = new THREE.Object3D();
  chestAnchor.position.set(0, 0.4 + sp.chestH * 0.55, sp.chestD / 2 + 0.1);
  torso.add(chestAnchor);

  // ---------- Đầu ----------
  const head = new THREE.Group();
  head.position.set(0, chestTop + 0.1, sp.headZ);
  torso.add(head);
  rbox(sp.headW, sp.headH, sp.headD, body, 0, sp.headH / 2, 0, head, 0.07);
  rbox(sp.headW * 0.72, 0.14, sp.headD * 0.86, dark, 0, -0.01, 0.03, head, 0.04); // hàm
  if (id === 'p1') {
    // Atom: hai mắt xanh, mặt kính đen
    rbox(sp.headW * 0.84, 0.17, 0.05, dark, 0, sp.headH * 0.62, sp.headD / 2 + 0.005, head, 0.03);
    for (const s of [1, -1]) rbox(0.12, 0.08, 0.05, eyeMat, s * 0.1, sp.headH * 0.62, sp.headD / 2 + 0.04, head, 0.02);
    rbox(0.08, 0.16, 0.28, trim, 0, sp.headH + 0.04, 0, head, 0.03); // sống đầu
  } else {
    // Zeus: lông mày nhô xuống, một khe mắt đỏ, sừng ở hai bên đầu
    const brow = rbox(sp.headW * 1.04, 0.1, 0.16, dark, 0, sp.headH * 0.78, sp.headD / 2, head, 0.03);
    brow.rotation.x = 0.25;
    rbox(sp.headW * 0.74, 0.08, 0.05, eyeMat, 0, sp.headH * 0.58, sp.headD / 2 + 0.02, head, 0.02);
    for (const s of [1, -1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), trim);
      horn.position.set(s * (sp.headW / 2 + 0.02), sp.headH * 0.6, -0.02);
      horn.rotation.z = -s * 1.1;
      horn.castShadow = true;
      head.add(horn);
    }
  }

  // ---------- Tay: vai -> cánh tay -> khuỷu -> cẳng tay -> găng ----------
  const shoulderY = chestTop - 0.2;
  const arms = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * sp.shoulderX, shoulderY, 0);
    torso.add(shoulder);
    ball(sp.armR * 1.35, trim, 0, 0.04, 0, shoulder);
    const pad = rbox(sp.padW, sp.padH, sp.padD, body, s * 0.04, 0.12, 0, shoulder, 0.07);
    pad.rotation.z = -s * 0.12;
    rbox(sp.padW * 0.5, 0.05, sp.padD * 0.8, trim, s * 0.04, 0.12 + sp.padH * 0.5, 0, shoulder, 0.02);
    if (id === 'p2') {
      for (const z of [-0.2, 0.2]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), dark);
        spike.position.set(s * 0.06, 0.12 + sp.padH * 0.5 + 0.14, z);
        spike.castShadow = true;
        shoulder.add(spike);
      }
    }
    cyl(sp.armR, sp.armR * 0.9, 0.55, dark, 0, -0.275, 0, shoulder);
    rbox(sp.armR * 2.1, 0.16, sp.armR * 2.2, trim, 0, -0.14, 0, shoulder, 0.04); // vòng giáp bắp tay

    const elbow = new THREE.Group();
    elbow.position.y = -0.55;
    shoulder.add(elbow);
    ball(sp.armR * 1.3, trim, 0, 0, 0, elbow);
    rbox(sp.armR * 2.3, 0.5, sp.armR * 2.4, trim, 0, -0.27, 0, elbow, 0.05);
    rbox(sp.armR * 2.4, 0.04, sp.armR * 2.5, rimMat, 0, -0.14, 0, elbow, 0.01);
    rbox(sp.armR * 1.6, 0.3, 0.05, dark, 0, -0.3, sp.armR * 1.2 + 0.02, elbow, 0.02);

    const wrist = new THREE.Group();
    wrist.position.y = -0.5;
    elbow.add(wrist);
    cyl(sp.armR * 0.8, sp.armR * 0.8, 0.12, dark, 0, 0, 0, wrist, 12);
    rbox(sp.fist, sp.fist, sp.fist * 1.08, body, 0, -sp.fist * 0.45, 0.02, wrist, 0.09); // găng
    rbox(sp.fist * 1.04, sp.fist * 0.3, sp.fist * 0.5, trim, 0, -sp.fist * 0.2, sp.fist * 0.35, wrist, 0.05); // phần đốt ngón
    rbox(sp.fist * 0.9, 0.05, 0.05, rimMat, 0, -sp.fist * 0.2, sp.fist * 0.6, wrist, 0.01);
    arms[side] = { shoulder, elbow };
  }

  const channels = {
    bodyX: [root.position, 'x'], bodyY: [root.position, 'y'], bodyZ: [root.position, 'z'],
    bodyRx: [root.rotation, 'x'], bodyRz: [root.rotation, 'z'],
    twist: [torso.rotation, 'y'], spineX: [torso.rotation, 'x'],
    headX: [head.rotation, 'x'], headY: [head.rotation, 'y'],
    shLx: [arms.L.shoulder.rotation, 'x'], shLz: [arms.L.shoulder.rotation, 'z'], elL: [arms.L.elbow.rotation, 'x'],
    shRx: [arms.R.shoulder.rotation, 'x'], shRz: [arms.R.shoulder.rotation, 'z'], elR: [arms.R.elbow.rotation, 'x'],
    hipL: [legs.L.hip.rotation, 'x'], kneeL: [legs.L.knee.rotation, 'x'],
    hipR: [legs.R.hip.rotation, 'x'], kneeR: [legs.R.knee.rotation, 'x'],
  };

  const glowBase = new THREE.Color(pal.glow);
  const phase = id === 'p1' ? 0 : 1.7;

  const robot = {
    id,
    group,
    chestAnchor,
    glowColor: glowBase,
    base: 'idle', // tư thế nền: 'idle' | 'guard'
    ko: false,
    power: 1, // độ sáng đèn (0 khi KO)
    flash: 0, // nháy khi trúng đòn
    flashColor: new THREE.Color(0xff2a3d),
    channels,
    // Các object mà tween có thể đang điều khiển, để huỷ khi reset
    targets: new Set(Object.values(channels).map((c) => c[0])),

    setChannel(name, value) {
      const [obj, key] = channels[name];
      obj[key] = value;
    },

    applyPose(pose) {
      for (const [k, v] of Object.entries(pose)) this.setChannel(k, v);
    },

    reset() {
      this.base = 'idle';
      this.ko = false;
      this.power = 1;
      this.flash = 0;
      this.applyPose(BASE.idle);
    },

    update(dt, t) {
      this.flash *= Math.exp(-dt / 140);
      const f = Math.min(1, this.flash);
      for (const m of glowMats) {
        m.emissive.copy(m.userData.base).lerp(this.flashColor, f);
        m.emissiveIntensity = m.userData.baseI * this.power + this.flash * 2.5;
      }

      // Gập hông/gối thì hông hạ xuống: hạ cả thân để chân nào thấp hơn vẫn chạm sàn
      let drop = 0;
      if (!this.ko) {
        const reach = (leg) => {
          const h = leg.hip.rotation.x;
          return thigh * Math.cos(h) + shin * Math.cos(h + leg.knee.rotation.x);
        };
        drop = Math.min(reach(legs.L), reach(legs.R)) - (thigh + shin);
      }
      ground.position.y = drop;
      // Bàn chân luôn nằm phẳng theo mặt sàn
      for (const leg of Object.values(legs)) leg.foot.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x);

      bob.position.y = this.ko ? 0 : Math.abs(Math.sin(t * 0.0032 + phase)) * 0.035;
    },
  };

  robot.targets.add(robot);
  robot.applyPose(BASE.idle);
  return robot;
}
