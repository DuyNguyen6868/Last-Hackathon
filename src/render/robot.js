import * as THREE from 'three';
import { BASE } from './poses.js';

// Robot kiểu Real Steel: thân vuông, găng to, visor phát sáng. p1 = "Atom" xanh, p2 = "Zeus" đen-đỏ.
export const PALETTES = {
  p1: { body: 0x7d8da6, trim: 0x1c2a40, dark: 0x0f1218, glow: 0x00e5ff },
  p2: { body: 0x2a2b34, trim: 0xc8962c, dark: 0x0a0a0d, glow: 0xff2a3d },
};

export function createRobot(id) {
  const pal = PALETTES[id];
  const glowMats = [];
  const metal = (color, rough = 0.4, metalness = 0.6) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness });
  const body = metal(pal.body);
  const trim = metal(pal.trim, 0.35, 0.7);
  const dark = metal(pal.dark, 0.5, 0.8);
  const glow = (intensity = 2.4) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.glow, emissiveIntensity: intensity });
    m.userData.baseI = intensity;
    glowMats.push(m);
    return m;
  };
  const glowMat = glow();

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent?.add(m);
    return m;
  };

  const group = new THREE.Group();   // đặt vị trí và hướng nhìn ngoài scene
  const bob = new THREE.Group();     // nhún nhảy kiểu võ sĩ
  const root = new THREE.Group();    // trục xoay ở bàn chân, nhận các kênh bodyX/Y/Z/Rx/Rz
  group.add(bob);
  bob.add(root);

  // Chân (chân trái đứng trước một chút như tư thế võ sĩ)
  const legs = [];
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.32, 0, s > 0 ? 0.14 : -0.08);
    box(0.36, 0.55, 0.4, body, 0, 0.78, 0, leg);
    box(0.3, 0.16, 0.14, trim, 0, 0.62, 0.22, leg);
    box(0.3, 0.5, 0.34, dark, 0, 0.3, 0, leg);
    box(0.4, 0.16, 0.66, trim, 0, 0.08, 0.1, leg);
    root.add(leg);
    legs.push(leg);
  }

  // Hông
  box(0.9, 0.3, 0.55, trim, 0, 1.05, 0, root);
  box(0.92, 0.04, 0.57, glow(1.3), 0, 1.2, 0, root);

  // Thân trên (xoay quanh trục Y ở eo)
  const torso = new THREE.Group();
  torso.position.set(0, 1.2, 0);
  root.add(torso);
  box(0.7, 0.4, 0.45, dark, 0, 0.2, 0, torso);
  box(1.25, 0.85, 0.7, body, 0, 0.8, 0, torso);
  box(0.9, 0.5, 0.06, trim, 0, 0.85, 0.36, torso);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 20), glowMat);
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.85, 0.4);
  torso.add(core);
  box(0.8, 0.7, 0.25, dark, 0, 0.8, -0.45, torso);
  box(0.25, 0.15, 0.25, dark, 0, 1.3, 0, torso);
  const chestAnchor = new THREE.Object3D();
  chestAnchor.position.set(0, 0.85, 0.5);
  torso.add(chestAnchor);

  // Đầu
  const head = new THREE.Group();
  head.position.set(0, 1.38, 0);
  torso.add(head);
  box(0.5, 0.44, 0.5, body, 0, 0.22, 0, head);
  box(0.34, 0.14, 0.4, dark, 0, -0.02, 0.04, head);
  box(0.38, 0.1, 0.06, glowMat, 0, 0.25, 0.26, head);
  box(0.1, 0.14, 0.4, trim, 0, 0.5, 0, head);
  for (const s of [1, -1]) box(0.08, 0.2, 0.18, trim, s * 0.29, 0.22, 0, head);

  // Tay
  const arms = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.82, 1.05, 0);
    torso.add(shoulder);
    box(0.4, 0.34, 0.56, body, s * 0.02, 0.1, 0, shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 14), dark);
    upper.position.y = -0.275;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.55;
    shoulder.add(elbow);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), trim);
    joint.castShadow = true;
    elbow.add(joint);
    box(0.26, 0.5, 0.28, trim, 0, -0.25, 0, elbow);
    box(0.28, 0.04, 0.3, glowMat, 0, -0.15, 0, elbow);
    const fist = new THREE.Group();
    fist.position.y = -0.5;
    elbow.add(fist);
    box(0.42, 0.42, 0.46, body, 0, -0.1, 0.02, fist);
    const fistGlow = glow(); // material riêng để găng sáng cam khi lấy đà
    box(0.44, 0.08, 0.1, fistGlow, 0, -0.04, 0.24, fist);
    // Lớp vỏ phát sáng quanh găng, chỉ hiện khi lấy đà
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.6),
      new THREE.MeshBasicMaterial({
        color: 0xff8a00, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    shell.position.set(0, -0.1, 0.02);
    shell.visible = false;
    fist.add(shell);
    arms[side] = { shoulder, elbow, fistGlow, shell };
  }

  const channels = {
    bodyX: [root.position, 'x'], bodyY: [root.position, 'y'], bodyZ: [root.position, 'z'],
    bodyRx: [root.rotation, 'x'], bodyRz: [root.rotation, 'z'],
    twist: [torso.rotation, 'y'],
    headX: [head.rotation, 'x'], headY: [head.rotation, 'y'],
    shLx: [arms.L.shoulder.rotation, 'x'], shLz: [arms.L.shoulder.rotation, 'z'], elL: [arms.L.elbow.rotation, 'x'],
    shRx: [arms.R.shoulder.rotation, 'x'], shRz: [arms.R.shoulder.rotation, 'z'], elR: [arms.R.elbow.rotation, 'x'],
  };

  const glowBase = new THREE.Color(pal.glow);
  const chargeColor = new THREE.Color(0xff8a00);
  const phase = id === 'p1' ? 0 : 1.7;

  const robot = {
    id,
    group,
    chestAnchor,
    glowColor: glowBase,
    base: 'idle',   // tư thế nền: 'idle' | 'guard'
    ko: false,
    power: 1,       // độ sáng đèn (0 khi KO)
    flash: 0,       // nháy khi trúng đòn
    flashColor: new THREE.Color(0xff2a3d),
    charge: { L: null, R: null }, // lấy đà: { t0, dur } theo từng tay
    walkAmount: 0,
    channels,
    // Các object mà tween có thể đang điều khiển, để huỷ khi reset
    targets: new Set(Object.values(channels).map((c) => c[0])),

    setChannel(name, value) {
      const [obj, key] = channels[name];
      obj[key] = value;
    },

    setWalking(amount) {
      this.walkAmount = Math.max(0, Math.min(1, amount));
    },

    applyPose(pose) {
      for (const [k, v] of Object.entries(pose)) this.setChannel(k, v);
    },

    reset() {
      this.base = 'idle';
      this.ko = false;
      this.power = 1;
      this.flash = 0;
      this.clearCharge();
      this.applyPose(BASE.idle);
    },

    telegraph(side, ms, now) {
      this.charge[side] = { t0: now, dur: ms };
    },

    clearCharge(side) {
      for (const s of side ? [side] : ['L', 'R']) {
        this.charge[s] = null;
        arms[s].shell.visible = false;
      }
    },

    update(dt, t) {
      this.flash *= Math.exp(-dt / 140);
      const f = Math.min(1, this.flash);
      for (const m of glowMats) {
        m.emissive.copy(glowBase).lerp(this.flashColor, f);
        m.emissiveIntensity = m.userData.baseI * this.power + this.flash * 2.5;
      }
      // Găng sáng cam và nhấp nháy nhanh dần khi lấy đà
      for (const s of ['L', 'R']) {
        const c = this.charge[s];
        if (!c) continue;
        const p = (t - c.t0) / c.dur;
        if (p > 1.4) {
          this.clearCharge(s);
          continue;
        }
        const level = Math.min(1, p);
        const pulse = 0.65 + 0.35 * Math.sin(t * (0.02 + level * 0.05));
        arms[s].fistGlow.emissive.copy(chargeColor);
        arms[s].fistGlow.emissiveIntensity = 2 + 4 * level * pulse;
        arms[s].shell.visible = true;
        arms[s].shell.material.opacity = (0.12 + 0.4 * level) * pulse;
      }
      const stride = Math.sin(t * 0.012 + phase) * 0.48 * this.walkAmount;
      legs[0].rotation.x = stride;
      legs[1].rotation.x = -stride;
      bob.position.y = this.ko ? 0 : Math.abs(Math.sin(t * (this.walkAmount ? 0.012 : 0.0032) + phase)) * (0.035 + this.walkAmount * 0.035);
    },
  };

  robot.targets.add(robot);
  robot.applyPose(BASE.idle);
  return robot;
}
