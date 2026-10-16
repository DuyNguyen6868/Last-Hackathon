import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Model thật (Sketchfab, CC BY 4.0):
//   p1 Atom:         "Real Steel HD Original Atom Model" by RealSteelFan200, 22 mảnh rời sẵn xương.
//   p2 Twin Cities:  "Twin Cities" by VIRKM, 13 mảnh gộp (trái+phải chung 1 mảnh), KHÔNG có xương.
//
// Ta KHÔNG đổi anim.js/poses.js: robot dựng bằng code vẫn là "kho giá trị khớp" mà tween điều khiển,
// còn model thật chỉ đọc các giá trị đó mỗi frame rồi xoay xương tương ứng.
// Với Twin Cities, ta tự tách mảnh trái/phải và dựng xương (xem twinBones).

export const CREDIT = {
  p1: 'Atom: "Real Steel HD Original Atom Model" by RealSteelFan200, CC BY 4.0 (sketchfab.com)',
  p2: 'Twin Cities: "Twin Cities" by VIRKM, CC BY 4.0 (sketchfab.com)',
};

const BASE_URL = import.meta.env?.BASE_URL ?? '/';
const MODEL_FILES = { p1: 'atom.glb', p2: 'twin_cities.glb' };
// scale: đưa model về cao ~2.6; bright: nhân màu texture (texture gốc khá tối)
const MODEL_CFG = {
  p1: { scale: 115, bright: 1.9 }, // Atom gốc tính bằng cm
  p2: { scale: 1.1, bright: 1.5 },
};

const loading = {};
export function loadModel(id) {
  if (typeof window === 'undefined') return Promise.reject(new Error('không có trình duyệt'));
  loading[id] ??= new GLTFLoader().loadAsync(`${BASE_URL}models/${MODEL_FILES[id]}`).then((g) => g.scene);
  return loading[id];
}

const DOWN = new THREE.Vector3(0, -1, 0);
const IDENTITY = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

const fromTo = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to);
const half = (q) => IDENTITY.clone().slerp(q, 0.5);

// ---------------------------------------------------------------------------------------------
// Atom: xương có sẵn trong file
// ---------------------------------------------------------------------------------------------
function atomBones(model) {
  const get = (name) => {
    const o = model.getObjectByName(name);
    if (!o) throw new Error(`model thiếu xương ${name}`);
    return o;
  };
  const side = (s) => ({
    upper: get(`Robot_${s}_UpperArm`), fore: get(`Robot_${s}_Forearm`), hand: get(`Robot_${s}_Hand`),
    thigh: get(`Robot_${s}_Thigh`), calf: get(`Robot_${s}_Calf`), foot: get(`Robot_${s}_Foot`),
  });
  const bones = {
    spine1: get('Robot_Spine1'), spine2: get('Robot_Spine2'), neck: get('Robot_Neck'), head: get('Robot_Head'),
    pelvis: get('Robot_Pelvis'), L: side('L'), R: side('R'),
  };
  // Một material chung cho cả robot để nháy đỏ/nhuộm màu
  const material = new THREE.MeshStandardMaterial();
  let first = true;
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (first) {
      material.copy(o.material);
      first = false;
    }
    o.material = material;
  });
  material.metalness = 0.35;
  material.roughness = 0.6;
  return { bones, materials: [material] };
}

// ---------------------------------------------------------------------------------------------
// Twin Cities: tách mảnh trái/phải rồi dựng xương theo hộp bao của từng mảnh
// ---------------------------------------------------------------------------------------------
function splitSides(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index.array;
  const side = { L: [], R: [] };
  for (let i = 0; i < idx.length; i += 3) {
    const x = (pos.getX(idx[i]) + pos.getX(idx[i + 1]) + pos.getX(idx[i + 2])) / 3;
    side[x > 0 ? 'L' : 'R'].push(idx[i], idx[i + 1], idx[i + 2]); // robot nhìn +Z thì bên trái là +X
  }
  const make = (arr) => {
    const gg = g.clone();
    gg.setIndex(arr);
    gg.computeBoundingBox();
    return new THREE.Mesh(gg, mesh.material.clone());
  };
  return { L: make(side.L), R: make(side.R) };
}

function twinBones(model) {
  const host = model.getObjectByName('Sketchfab_model').children[0]; // nút chứa 13 mảnh (hệ tọa độ Z lên)
  const byMat = {};
  for (const m of [...host.children]) {
    byMat[m.material.name] = m;
    host.remove(m);
  }
  for (const k of ['Head', 'UpperSpine', 'MidSpine', 'LowerSpine', 'Pelvis', 'clavicle', 'UpperArm', 'Forearm', 'Hand', 'Thigh', 'Calf', 'Foot', 'material']) {
    if (!byMat[k]) throw new Error(`Twin Cities thiếu mảnh ${k}`);
  }
  const two = {};
  for (const k of ['UpperArm', 'Forearm', 'Hand', 'Thigh', 'Calf', 'Foot', 'material']) two[k] = splitSides(byMat[k]);
  const bbox = (m) => {
    m.geometry.computeBoundingBox();
    return m.geometry.boundingBox;
  };
  const cx = (b) => (b.min.x + b.max.x) / 2;
  const cy = (b) => (b.min.y + b.max.y) / 2;

  // Xương: pos là tọa độ tuyệt đối trong hệ của model, local = pos - pos của cha
  const abs = new Map();
  const bone = (pos, parent) => {
    const b = new THREE.Object3D();
    const pp = parent ? abs.get(parent) : new THREE.Vector3();
    b.position.copy(pos).sub(pp);
    abs.set(b, pos.clone());
    (parent ?? host).add(b);
    return b;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const bPelvis = bbox(byMat.Pelvis);
  const bMid = bbox(byMat.MidSpine);
  const bUp = bbox(byMat.UpperSpine);
  const bHead = bbox(byMat.Head);
  const midY = cy(bMid);

  const pelvis = bone(V(0, cy(bPelvis), (bPelvis.min.z + bPelvis.max.z) / 2), null);
  const spine1 = bone(V(0, midY, bMid.min.z), pelvis);
  const spine2 = bone(V(0, midY, (bMid.min.z + bUp.max.z) / 2), spine1);
  const neck = bone(V(0, cy(bHead), bHead.min.z + 0.03), spine2);
  const head = bone(V(0, cy(bHead), bHead.min.z + 0.03), neck);

  const bones = { spine1, spine2, neck, head, pelvis };
  const pairs = [];
  for (const s of ['L', 'R']) {
    const ua = bbox(two.UpperArm[s]); const fa = bbox(two.Forearm[s]); const hd = bbox(two.Hand[s]);
    const th = bbox(two.Thigh[s]); const ca = bbox(two.Calf[s]); const ft = bbox(two.Foot[s]);
    const upper = bone(V(cx(ua), cy(ua), ua.max.z - 0.12), spine2);
    const fore = bone(V((cx(ua) + cx(fa)) / 2, (cy(ua) + cy(fa)) / 2, (ua.min.z + fa.max.z) / 2), upper);
    const hand = bone(V(cx(fa), cy(fa), hd.max.z), fore);
    const thigh = bone(V(cx(th), cy(th), th.max.z - 0.1), pelvis);
    const calf = bone(V((cx(th) + cx(ca)) / 2, (cy(th) + cy(ca)) / 2, (th.min.z + ca.max.z) / 2), thigh);
    const foot = bone(V(cx(ca), cy(ca), (ca.min.z + ft.max.z) / 2), calf);
    bones[s] = { upper, fore, hand, thigh, calf, foot };
    pairs.push([bones[s].upper, two.UpperArm[s]], [bones[s].fore, two.Forearm[s]], [bones[s].hand, two.Hand[s]],
      [bones[s].thigh, two.Thigh[s]], [bones[s].calf, two.Calf[s]], [bones[s].foot, two.Foot[s]], [bones[s].foot, two.material[s]]);
  }
  pairs.push([pelvis, byMat.Pelvis], [spine1, byMat.LowerSpine], [spine1, byMat.MidSpine],
    [spine2, byMat.UpperSpine], [spine2, byMat.clavicle], [head, byMat.Head]);

  // Gắn mảnh vào xương mà không đổi vị trí thế giới (bắt đầu từ vị trí gốc dưới host)
  host.updateMatrixWorld(true);
  const materials = [];
  for (const [b, mesh] of pairs) {
    if (mesh.material === byMat.Head?.material || !materials.includes(mesh.material)) {
      mesh.material = mesh.material.clone();
    }
    materials.push(mesh.material);
    host.add(mesh);
    host.updateMatrixWorld(true);
    b.attach(mesh);
  }
  return { bones, materials };
}

/**
 * parts = các object của robot dựng bằng code (nguồn giá trị khớp):
 *   { root, ground, bob, torso, head, arms: {L:{shoulder,elbow}, R}, legs: {L:{hip,knee}, R} }
 * Trả về { holder, update(t), materials } hoặc ném lỗi nếu thiếu xương/mảnh.
 */
export function buildModelRig(scene, parts, id = 'p1') {
  const cfg = MODEL_CFG[id];
  const model = cloneScene(scene);
  const { bones: B, materials } = id === 'p1' ? atomBones(model) : twinBones(model);
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  for (const m of materials) {
    m.color.multiplyScalar(cfg.bright);
    m.side = THREE.DoubleSide;
  }

  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(cfg.scale);
  parts.root.add(holder);

  // Đưa tâm hông về gốc tọa độ, bàn chân chạm sàn, rồi chụp tư thế gốc
  parts.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const rootInv = parts.root.matrixWorld.clone().invert();
  const pelvisLocal = B.pelvis.getWorldPosition(new THREE.Vector3()).applyMatrix4(rootInv);
  const minLocal = box.min.clone().applyMatrix4(rootInv);
  holder.position.set(-pelvisLocal.x, -minLocal.y, -pelvisLocal.z);
  parts.root.updateMatrixWorld(true);

  const holderInv = holder.matrixWorld.clone().invert();
  const holderQ = holder.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rest = new Map(); // bone -> { local, W (thế giới tương đối holder), Winv }
  const all = [B.spine1, B.spine2, B.neck, B.head, ...Object.values(B.L), ...Object.values(B.R)];
  for (const b of all) {
    const W = holderQ.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    rest.set(b, { local: b.quaternion.clone(), W, Winv: W.clone().invert() });
  }
  const posIn = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(holderInv);
  const dir = (a, b) => posIn(b).sub(posIn(a)).normalize();
  const restDir = {};
  for (const s of ['L', 'R']) {
    restDir[s] = {
      upper: dir(B[s].upper, B[s].fore), fore: dir(B[s].fore, B[s].hand),
      thigh: dir(B[s].thigh, B[s].calf), shin: dir(B[s].calf, B[s].foot),
    };
  }

  // local' = restLocal * (W^-1 * R * W): R là phép xoay trong trục của holder (không phụ thuộc trục xương)
  const setDelta = (bone, R) => {
    const r = rest.get(bone);
    bone.quaternion.copy(r.local).multiply(r.Winv).multiply(R).multiply(r.W);
  };

  const group = parts.root.parent.parent.parent;
  const box2 = new THREE.Box3();
  const q = new THREE.Quaternion();

  function update() {
    // Thân trên: chia đều xoay (twist, spineX) cho 2 đốt sống
    const Rh = half(q.setFromEuler(parts.torso.rotation).clone());
    setDelta(B.spine1, Rh);
    setDelta(B.spine2, Rh);

    // Đầu: nửa ở cổ, nửa ở đầu
    const Rhead = half(new THREE.Quaternion().setFromEuler(parts.head.rotation));
    setDelta(B.neck, Rhead);
    setDelta(B.head, Rhead);

    for (const s of ['L', 'R']) {
      // Tay: đích là hướng của đoạn xương (tính từ giá trị khớp của robot code), không phải góc trục xương
      const a = parts.arms[s];
      const uLocal = _a.copy(DOWN).applyEuler(a.shoulder.rotation).clone();
      const fLocal = _b.copy(DOWN).applyEuler(a.elbow.rotation).applyEuler(a.shoulder.rotation).clone();
      const Rsh = fromTo(restDir[s].upper, uLocal);
      const Rel = fromTo(restDir[s].fore, fLocal.applyQuaternion(Rsh.clone().invert()));
      setDelta(B[s].upper, Rsh);
      setDelta(B[s].fore, Rel);
      setDelta(B[s].hand, IDENTITY);

      const l = parts.legs[s];
      const tLocal = _a.copy(DOWN).applyEuler(l.hip.rotation).clone();
      const sLocal = _b.copy(DOWN).applyEuler(l.knee.rotation).applyEuler(l.hip.rotation).clone();
      const Rth = fromTo(restDir[s].thigh, tLocal);
      const Rca = fromTo(restDir[s].shin, sLocal.applyQuaternion(Rth.clone().invert()));
      setDelta(B[s].thigh, Rth);
      setDelta(B[s].calf, Rca);
      setDelta(B[s].foot, Rth.clone().multiply(Rca).invert()); // bàn chân luôn phẳng
    }

    // Luôn đặt điểm thấp nhất của robot trên sàn (đứng, gập gối, hoặc nằm khi KO)
    parts.ground.position.y = 0;
    parts.bob.position.y = 0;
    group.updateMatrixWorld(true);
    box2.setFromObject(holder);
    parts.ground.position.y = -(box2.min.y - group.position.y) / group.scale.x;
  }

  return { holder, update, materials, hands: { L: B.L.hand, R: B.R.hand } };
}
