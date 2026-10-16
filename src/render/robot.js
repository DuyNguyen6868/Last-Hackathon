// Robot dựng từ hình khối (Thành). Robot nhìn về hướng +z trong toạ độ local.
// Bên trái của robot là +x. Tay là 2 đoạn (vai→khuỷu→găng) giải bằng IK 2 khớp.
import * as THREE from 'three';

const ARM_UPPER = 0.8;
const ARM_FORE = 0.8;
const SHOULDER_Y = 1.15; // so với khung "upper" (đặt ở hông)
const SHOULDER_X = 0.68;

// Vị trí găng tay (local trong khung upper), cho tay trái. Tay phải đối xứng qua x.
const GLOVE = {
  idle: new THREE.Vector3(0.32, 1.32, 0.6),
  guard: new THREE.Vector3(0.18, 1.58, 0.48),
  jab: new THREE.Vector3(0.2, 1.38, 1.5),
  hookStart: new THREE.Vector3(1.0, 1.4, 0.55),
  hookEnd: new THREE.Vector3(-0.1, 1.45, 1.3),
};

const ACTION_MS = { jab: 300, hook: 420, hit: 320 };
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const mirror = (v, side) => new THREE.Vector3(v.x * side, v.y, v.z);
const ease = (t) => (t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65); // ra nhanh, thu chậm

function placeSegment(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  mesh.scale.set(1, len, 1);
}

// IK 2 khớp: trả về vị trí khuỷu tay và vị trí găng (đã giới hạn trong tầm với)
function solveArm(shoulder, target, side) {
  const toT = new THREE.Vector3().subVectors(target, shoulder);
  const d = Math.min(toT.length(), ARM_UPPER + ARM_FORE - 0.001);
  const dir = toT.normalize();
  const glove = shoulder.clone().addScaledVector(dir, d);
  const along = (ARM_UPPER ** 2 - ARM_FORE ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, ARM_UPPER ** 2 - along ** 2));
  // khuỷu tay chỉ ra ngoài và xuống dưới
  const hint = new THREE.Vector3(side * 0.7, -1, 0);
  const perp = hint.sub(dir.clone().multiplyScalar(hint.dot(dir))).normalize();
  const elbow = shoulder.clone().addScaledVector(dir, along).addScaledVector(perp, h);
  return { elbow, glove };
}

export class Robot {
  constructor(color) {
    this.root = new THREE.Group();
    this.upper = new THREE.Group();
    this.upper.position.y = 1.2;
    this.root.add(this.upper);

    const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.8, roughness: 0.4 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x66e0ff, emissiveIntensity: 2 });
    this.materials = [metal, dark];
    const box = (w, h, d, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.castShadow = true;
      return m;
    };

    // Chân
    for (const side of [1, -1]) {
      const leg = box(0.3, 1.1, 0.35, dark);
      leg.position.set(0.25 * side, 0.6, 0);
      this.root.add(leg);
      const foot = box(0.36, 0.14, 0.55, metal);
      foot.position.set(0.25 * side, 0.07, 0.08);
      this.root.add(foot);
    }

    // Thân, đầu
    const torso = box(1.05, 1.15, 0.6, metal);
    torso.position.y = 0.72;
    const chest = box(0.6, 0.35, 0.08, dark);
    chest.position.set(0, 0.9, 0.32);
    this.head = box(0.46, 0.46, 0.46, metal);
    this.head.position.y = 1.6;
    const visor = box(0.36, 0.09, 0.05, this.eyeMat);
    visor.position.set(0, 0.04, 0.24);
    this.head.add(visor);
    this.upper.add(torso, chest, this.head);

    // Tay
    const seg = (w, mat) => {
      const g = new THREE.CylinderGeometry(w, w, 1, 10);
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      return m;
    };
    this.arms = {};
    for (const [hand, side] of [['L', 1], ['R', -1]]) {
      const shoulderPos = new THREE.Vector3(SHOULDER_X * side, SHOULDER_Y, 0);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), metal);
      shoulder.position.copy(shoulderPos);
      const upperArm = seg(0.1, dark);
      const foreArm = seg(0.09, dark);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), metal);
      glove.castShadow = true;
      this.upper.add(shoulder, upperArm, foreArm, glove);
      this.arms[hand] = {
        side,
        shoulderPos,
        upperArm,
        foreArm,
        glove,
        current: mirror(GLOVE.idle, side),
      };
    }

    this.reset();
  }

  reset() {
    this.base = 'idle'; // idle | guard | dodge_L | dodge_R
    this.action = null; // { type, hand, t0 }
    this.ko = null; // thời điểm bị KO
    this.flashUntil = 0;
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.root.position.y = 0;
    this.eyeMat.emissiveIntensity = 2;
  }

  play(name, now = performance.now()) {
    if (name === 'reset') return this.reset();
    if (name === 'ko') {
      this.ko = now;
      return;
    }
    if (['idle', 'guard', 'dodge_L', 'dodge_R'].includes(name)) {
      this.base = name;
      return;
    }
    if (name === 'hit') {
      this.action = { type: 'hit', t0: now };
      this.flashUntil = now + 150;
      return;
    }
    const [type, hand] = name.split('_'); // jab_L, hook_R
    this.action = { type, hand, t0: now };
  }

  // Vị trí găng ở thế giới, dùng cho hiệu ứng tia lửa
  gloveWorld(hand) {
    return this.arms[hand].glove.getWorldPosition(new THREE.Vector3());
  }

  headWorld() {
    return this.head.getWorldPosition(new THREE.Vector3());
  }

  update(dt, now) {
    const k = 1 - Math.exp(-dt * 22);

    // KO: ngã ngửa ra sau
    if (this.ko !== null) {
      const t = Math.min((now - this.ko) / 800, 1);
      this.root.rotation.x = -Math.PI / 2 * t * t;
      this.root.position.y = 0.3 * Math.sin(t * Math.PI);
      this.eyeMat.emissiveIntensity = 2 * (1 - t);
    }

    // Thân: né và bị trúng đòn
    let leanX = 0;
    let shiftX = 0;
    let roll = 0;
    if (this.base === 'dodge_L') { shiftX = 0.45; roll = -0.28; }
    if (this.base === 'dodge_R') { shiftX = -0.45; roll = 0.28; }

    let act = null;
    if (this.action) {
      const p = (now - this.action.t0) / ACTION_MS[this.action.type];
      if (p >= 1) this.action = null;
      else act = { ...this.action, e: ease(p), p };
    }
    if (act?.type === 'hit') leanX = -0.35 * act.e;

    const bob = Math.sin(now * 0.005) * 0.03;
    this.upper.position.x += (shiftX - this.upper.position.x) * k;
    this.upper.position.y = 1.2 + bob;
    this.upper.rotation.x += (leanX - this.upper.rotation.x) * k;
    this.upper.rotation.z += (roll - this.upper.rotation.z) * k;

    // Tay
    for (const [hand, arm] of Object.entries(this.arms)) {
      const basePose = this.base === 'guard' ? GLOVE.guard : GLOVE.idle;
      let target = mirror(basePose, arm.side);
      if (act && act.hand === hand && act.type === 'jab') {
        target.lerp(mirror(GLOVE.jab, arm.side), act.e);
      } else if (act && act.hand === hand && act.type === 'hook') {
        const path = mirror(GLOVE.hookStart, arm.side).lerp(mirror(GLOVE.hookEnd, arm.side), act.p);
        target.lerp(path, Math.min(1, act.e * 1.5));
      }
      const snap = act && act.hand === hand ? 1 : k; // đòn đánh không làm mượt cho nhanh
      arm.current.lerp(target, snap);
      const { elbow, glove } = solveArm(arm.shoulderPos, arm.current, arm.side);
      placeSegment(arm.upperArm, arm.shoulderPos, elbow);
      placeSegment(arm.foreArm, elbow, glove);
      arm.glove.position.copy(glove);
    }

    // Nháy đỏ khi bị trúng
    const flash = now < this.flashUntil ? 0.8 : 0;
    for (const m of this.materials) {
      m.emissive.setRGB(flash, 0, 0);
    }
  }
}
