import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const CYAN = 0x00e5ff;
const RED = 0xff2a3d;
const MAGENTA = 0xff2bd6;

const glowMat = (color, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });

// Đấu trường neon: sàn lưới, 4 cột, dây đài 3 cạnh (bỏ cạnh gần camera), nền thanh sáng.
export function buildStage(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.Fog(0x04060c, 14, 38);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pmrem.dispose();

  // Sàn
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 0.6, roughness: 0.35 }),
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(9.6, 24, CYAN, 0x0d3a4a);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const circle = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.36, 64),
    new THREE.MeshBasicMaterial({ color: CYAN, side: THREE.DoubleSide }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.02;
  scene.add(circle);

  // Viền sáng quanh sàn
  for (const [w, d, x, z] of [[10, 0.08, 0, 5], [10, 0.08, 0, -5], [0.08, 10, 5, 0], [0.08, 10, -5, 0]]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), glowMat(MAGENTA, 2.2));
    edge.position.set(x, 0.0, z);
    scene.add(edge);
  }

  // Cột và dây đài
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x14171f, metalness: 0.8, roughness: 0.4 });
  const corners = [[-4.6, -4.6, CYAN], [4.6, -4.6, RED], [-4.6, 4.6, CYAN], [4.6, 4.6, RED]];
  for (const [x, z, c] of corners) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.4, 14), pillarMat);
    p.position.set(x, 1.2, z);
    p.castShadow = true;
    scene.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), glowMat(c, 3));
    cap.position.set(x, 2.46, z);
    scene.add(cap);
  }
  const ropeColors = [RED, 0xffffff, CYAN];
  const ropeY = [0.8, 1.35, 1.9];
  const ropes = [
    { len: 9.2, pos: (y) => [0, y, -4.6], rotY: 0 },
    { len: 9.2, pos: (y) => [-4.6, y, 0], rotY: Math.PI / 2 },
    { len: 9.2, pos: (y) => [4.6, y, 0], rotY: Math.PI / 2 },
  ];
  for (const r of ropes) {
    ropeY.forEach((y, i) => {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, r.len, 8), glowMat(ropeColors[i], 1.6));
      rope.rotation.z = Math.PI / 2;
      rope.rotation.y = r.rotY;
      rope.position.set(...r.pos(y));
      scene.add(rope);
    });
  }

  // Mặt đất tối bên ngoài đài
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: 0x05070d, metalness: 0.3, roughness: 0.8 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.41;
  scene.add(ground);

  // Vòng thanh sáng ở nền
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1, 0.4), new THREE.MeshBasicMaterial(), 56);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < bars.count; i++) {
    const a = (i / bars.count) * Math.PI * 2;
    const r = 15 + (i % 3) * 2.2;
    const h = 2 + ((i * 37) % 11) * 0.9;
    m.compose(
      new THREE.Vector3(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r),
      new THREE.Quaternion(),
      new THREE.Vector3(1, h, 1),
    );
    bars.setMatrixAt(i, m);
    col.set([CYAN, MAGENTA, 0x3a6bff][i % 3]).multiplyScalar(1.6);
    bars.setColorAt(i, col);
  }
  scene.add(bars);

  // Ánh sáng
  scene.add(new THREE.HemisphereLight(0x233a66, 0x05060a, 0.35));

  const key = new THREE.SpotLight(0xbdd4ff, 150, 0, 0.65, 0.6, 2);
  key.position.set(0, 9, 0.5);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);

  const cyanLight = new THREE.SpotLight(CYAN, 90, 0, 0.8, 0.7, 2);
  cyanLight.position.set(-5, 5, 4);
  cyanLight.target.position.set(0, 1.2, 2.2);
  scene.add(cyanLight, cyanLight.target);

  const redLight = new THREE.SpotLight(RED, 90, 0, 0.8, 0.7, 2);
  redLight.position.set(5, 5, -4);
  redLight.target.position.set(0, 1.2, -2.2);
  scene.add(redLight, redLight.target);

  // Camera sau lưng p1, hơi chéo
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  const rig = {
    pos: new THREE.Vector3(1.5, 3.2, 7.8),
    target: new THREE.Vector3(0.1, 1.3, -0.9),
  };
  camera.position.copy(rig.pos);
  camera.lookAt(rig.target);

  return { scene, camera, rig };
}
