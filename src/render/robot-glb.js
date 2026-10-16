import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE, CHANNELS } from './poses.js';
import { PALETTES } from './robot.js';

// Robot dùng model .glb (Atom, Zeus...). Trả về CÙNG giao diện với createRobot() trong robot.js
// (group, channels, targets, chestAnchor, reset, update, flash, power...) nên anim.js và effects.js
// không phải sửa gì. Nếu không có file hoặc tải lỗi, game giữ robot hình khối làm dự phòng.
//
// Yêu cầu model: có xương (rig kiểu Mixamo/Unreal/Blender đều được), đứng ở tư thế T-pose hoặc
// A-pose, nhìn về +z (mặc định của glTF/Mixamo). Nếu model nhìn ngược, đặt yaw: Math.PI.

export const GLB_MODELS = {
  p1: { url: `${import.meta.env?.BASE_URL ?? '/'}models/atom.glb` },
  p2: { url: `${import.meta.env?.BASE_URL ?? '/'}models/zeus.glb` },
  // Tuỳ chọn cho từng model:
  //   height: chiều cao robot trong cảnh (mặc định 2.9, robot hình khối cao ~2.9)
  //   yaw:    xoay model quanh trục dọc nếu nó không nhìn về +z
  //   bones:  ghi đè tên xương khi tự dò không ra, ví dụ { armL: 'Bip01_L_UpperArm' }
};

const DEFAULT_HEIGHT = 2.9;

// Tự dò xương theo tên đã chuẩn hoá (bỏ "mixamorig", ký tự lạ, chữ thường)
const norm = (s) => s.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
const PATTERNS = {
  armL: [/^leftarm$/, /^larm$/, /^(left|l)up(per)?arm$/, /^up(per)?arm(left|l)$/, /^arm(left|l)$/],
  foreL: [/^(left|l)(fore|lower)arm$/, /^(fore|lower)arm(left|l)$/],
  handL: [/^(left|l)hand$/, /^hand(left|l)$/],
  armR: [/^rightarm$/, /^rarm$/, /^(right|r)up(per)?arm$/, /^up(per)?arm(right|r)$/, /^arm(right|r)$/],
  foreR: [/^(right|r)(fore|lower)arm$/, /^(fore|lower)arm(right|r)$/],
  handR: [/^(right|r)hand$/, /^hand(right|r)$/],
  head: [/^head$/],
};

function findBones(model, overrides = {}) {
  const found = {};
  const all = [];
  model.traverse((o) => o.name && all.push(o));
  for (const [key, patterns] of Object.entries(PATTERNS)) {
    const named = overrides[key];
    found[key] = named
      ? all.find((o) => o.name === named)
      : all.find((o) => patterns.some((re) => re.test(norm(o.name))));
  }
  return found;
}

function commonAncestor(a, b) {
  const set = new Set();
  for (let o = a; o; o = o.parent) set.add(o);
  for (let o = b; o; o = o.parent) if (set.has(o)) return o;
  return null;
}

// Một kênh khớp ảo: tween ghi vào .v thì gọi onChange để tính lại xương
function driver(onChange) {
  return {
    _v: 0,
    get v() { return this._v; },
    set v(x) { this._v = x; onChange(x); },
  };
}

export function buildGlbRobot(id, model, cfg = {}) {
  const pal = PALETTES[id];
  const group = new THREE.Group();
  const bob = new THREE.Group();
  const root = new THREE.Group();   // trục xoay ở bàn chân, nhận các kênh bodyX/Y/Z/Rx/Rz
  const holder = new THREE.Group(); // chuẩn hoá kích thước, hướng, đặt chân xuống y=0
  group.add(bob);
  bob.add(root);
  root.add(holder);
  holder.add(model);

  holder.rotation.y = cfg.yaw ?? 0;
  holder.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(holder);
  holder.scale.setScalar((cfg.height ?? DEFAULT_HEIGHT) / Math.max(box.getSize(new THREE.Vector3()).y, 1e-6));
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -box.min.y, -c.z);
  root.updateMatrixWorld(true);

  // Tư thế nghỉ của xương, tính trong khung của `root` (không phụ thuộc vị trí group trong cảnh)
  const rootInv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const restQ = (o) => rootInv.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
  const restP = (o) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  const inv = (q) => q.clone().invert();
  const bones = findBones(model, cfg.bones);

  // --- Kênh thân (không cần xương) ---
  const channels = {
    bodyX: [root.position, 'x'], bodyY: [root.position, 'y'], bodyZ: [root.position, 'z'],
    bodyRx: [root.rotation, 'x'], bodyRz: [root.rotation, 'z'],
  };
  const missing = [];
  const down = new THREE.Vector3(0, -1, 0);
  const eul = new THREE.Euler();
  const q = new THREE.Quaternion();

  // Đặt xương theo phép quay `delta` biểu diễn trong khung nhân vật:
  //   local = Rparent^-1 * delta * pre * Rrest
  // (pre = đưa xương từ tư thế nghỉ về "buông xuôi" cho tay, nhận dạng tự động từ model)
  function makePoser(bone, pre = new THREE.Quaternion()) {
    const R = restQ(bone);
    const RpInv = inv(bone.parent ? restQ(bone.parent) : new THREE.Quaternion());
    return (delta) => {
      bone.quaternion.copy(RpInv).multiply(delta).multiply(pre).multiply(R);
    };
  }

  // --- Tay: vai (shLx, shLz) và khuỷu (elL) ---
  for (const s of ['L', 'R']) {
    const arm = bones[`arm${s}`];
    const fore = bones[`fore${s}`];
    const hand = bones[`hand${s}`] ?? fore?.children.find((o) => o.name);
    if (!arm || !fore) {
      missing.push(`arm${s}`);
      for (const k of [`sh${s}x`, `sh${s}z`, `el${s}`]) channels[k] = [driver(() => {}), 'v'];
      continue;
    }
    const preUp = new THREE.Quaternion().setFromUnitVectors(restP(fore).sub(restP(arm)).normalize(), down);
    const preFore = hand
      ? new THREE.Quaternion().setFromUnitVectors(restP(hand).sub(restP(fore)).normalize(), down)
      : preUp.clone();
    const poseArm = makePoser(arm, preUp);
    const sh = { x: 0, z: 0 };
    const applySh = () => poseArm(q.setFromEuler(eul.set(sh.x, 0, sh.z, 'XYZ')));
    channels[`sh${s}x`] = [driver((v) => { sh.x = v; applySh(); }), 'v'];
    channels[`sh${s}z`] = [driver((v) => { sh.z = v; applySh(); }), 'v'];

    // forearm local = R_arm^-1 * preUp^-1 * Rx(el) * preFore * R_fore (không phụ thuộc góc vai)
    const RarmInv = inv(restQ(arm));
    const RforeRest = restQ(fore);
    const preUpInv = inv(preUp);
    channels[`el${s}`] = [driver((v) => {
      fore.quaternion
        .copy(RarmInv).multiply(preUpInv)
        .multiply(q.setFromEuler(eul.set(v, 0, 0, 'XYZ')))
        .multiply(preFore).multiply(RforeRest);
    }), 'v'];
  }

  // --- Xoay thân: xương là tổ tiên chung của hai tay (thường là Spine2/Chest) ---
  const chest = bones.armL && bones.armR ? commonAncestor(bones.armL, bones.armR) : null;
  if (chest && chest !== model && chest.parent) {
    const poseChest = makePoser(chest);
    channels.twist = [driver((v) => poseChest(q.setFromEuler(eul.set(0, v, 0, 'XYZ')))), 'v'];
  } else {
    missing.push('chest');
    channels.twist = [driver(() => {}), 'v'];
  }

  // --- Đầu ---
  if (bones.head) {
    const poseHead = makePoser(bones.head);
    const h = { x: 0, y: 0 };
    const applyHead = () => poseHead(q.setFromEuler(eul.set(h.x, h.y, 0, 'XYZ')));
    channels.headX = [driver((v) => { h.x = v; applyHead(); }), 'v'];
    channels.headY = [driver((v) => { h.y = v; applyHead(); }), 'v'];
  } else {
    missing.push('head');
    channels.headX = [driver(() => {}), 'v'];
    channels.headY = [driver(() => {}), 'v'];
  }

  // --- Vật liệu: nháy đèn khi trúng đòn, tắt sáng khi KO ---
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) {
      if (m.emissive) mats.push({ m, e0: m.emissive.clone(), i0: m.emissiveIntensity ?? 1 });
    }
  });

  const chestAnchor = new THREE.Object3D();
  chestAnchor.position.set(0, (cfg.height ?? DEFAULT_HEIGHT) * 0.62, 0.45);
  root.add(chestAnchor);

  const phase = id === 'p1' ? 0 : 1.7;
  const robot = {
    id,
    group,
    chestAnchor,
    glowColor: new THREE.Color(pal.glow),
    base: 'idle',
    ko: false,
    power: 1,
    flash: 0,
    flashColor: new THREE.Color(0xff2a3d),
    channels,
    isGlb: true,
    bones,    // để debug: console.log(robots.p1.bones)
    missing,  // những khớp không dò ra xương (kênh tương ứng sẽ không làm gì)
    targets: new Set(Object.values(channels).map((ch) => ch[0])),

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
      for (const { m, e0, i0 } of mats) {
        m.emissive.copy(e0).lerp(this.flashColor, f);
        m.emissiveIntensity = i0 * this.power + this.flash * 1.5;
      }
      bob.position.y = this.ko ? 0 : Math.abs(Math.sin(t * 0.0032 + phase)) * 0.035;
    },
  };
  robot.targets.add(robot);
  for (const ch of CHANNELS) if (!(ch in channels)) channels[ch] = [driver(() => {}), 'v'];
  robot.applyPose(BASE.idle);
  return robot;
}

// Thay robot cũ bằng robot mới trong cảnh, giữ vị trí, hướng nhìn và tư thế nền
export function swapRobot(robots, scene, id, next) {
  const prev = robots[id];
  next.group.position.copy(prev.group.position);
  next.group.rotation.copy(prev.group.rotation);
  next.base = prev.base;
  next.applyPose(BASE[next.base]);
  scene.remove(prev.group);
  scene.add(next.group);
  robots[id] = next;
}

async function exists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    // Vite dev trả index.html (200) cho file không tồn tại, nên phải loại text/html
    return res.ok && !(res.headers.get('content-type') || '').includes('text/html');
  } catch {
    return false;
  }
}

// Thử tải model cho từng robot; lỗi hay thiếu file thì giữ nguyên robot hình khối.
export async function loadGlbRobots(robots, scene, models = GLB_MODELS) {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(models).map(async ([id, cfg]) => {
    if (!robots[id]) return;
    // glbRig.js (gắn trong robot.js) đã dựng được model chuyên biệt cho robot này thì không thay nữa
    await robots[id].ready;
    if (robots[id].model) {
      console.info(`[render] ${id}: đang dùng model dựng bởi glbRig.js`);
      return;
    }
    if (!(await exists(cfg.url))) {
      console.info(`[render] ${id}: chưa có ${cfg.url}, dùng robot hình khối`);
      return;
    }
    try {
      const gltf = await loader.loadAsync(cfg.url);
      const robot = buildGlbRobot(id, gltf.scene, cfg);
      swapRobot(robots, scene, id, robot);
      const note = robot.missing.length ? `, THIẾU xương: ${robot.missing.join(', ')}` : '';
      console.info(`[render] ${id}: đã tải ${cfg.url}${note}`);
    } catch (err) {
      console.warn(`[render] ${id}: không tải được ${cfg.url}, dùng robot hình khối:`, err.message);
    }
  }));
}
