// Đấu trường 3D (Thành): sàn đài, dây, đèn, camera, hiệu ứng trúng đòn.
import * as THREE from 'three';
import { on } from '../events.js';
import { Robot } from './robot.js';

const RING = 7;
const GAP = 0.85; // mỗi robot cách tâm sàn

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  scene.fog = new THREE.Fog(0x07090d, 10, 26);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  const camBase = new THREE.Vector3(2.4, 3.9, -GAP - 4.4);
  const lookAt = new THREE.Vector3(-0.3, 1.8, 0.9);

  // Đèn
  scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x101010, 0.6));
  const spot = new THREE.SpotLight(0xffffff, 300, 30, Math.PI / 5, 0.4);
  spot.position.set(0, 12, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot, spot.target);
  const rimBlue = new THREE.PointLight(0x2f7bff, 30, 12);
  rimBlue.position.set(-4, 4, -4);
  const rimRed = new THREE.PointLight(0xff3b3b, 30, 12);
  rimRed.position.set(4, 4, 4);
  scene.add(rimBlue, rimRed);

  // Sàn đài
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(RING, 0.4, RING),
    new THREE.MeshStandardMaterial({ color: 0x1d2a44, roughness: 0.8 }),
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(RING + 1, 0.6, RING + 1),
    new THREE.MeshStandardMaterial({ color: 0x0c0f16 }),
  );
  apron.position.y = -0.55;
  scene.add(apron);

  // Cột và dây
  const half = RING / 2 - 0.15;
  const postMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
  const corners = [[half, half], [-half, half], [-half, -half], [half, -half]];
  for (const [x, z] of corners) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 10), postMat);
    post.position.set(x, 1.1, z);
    scene.add(post);
  }
  const ropeColors = [0xff3b3b, 0xffffff, 0x2f7bff];
  for (let i = 0; i < 3; i++) {
    const y = 0.8 + i * 0.5;
    for (let c = 0; c < 4; c++) {
      const [x1, z1] = corners[c];
      const [x2, z2] = corners[(c + 1) % 4];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, len, 6),
        new THREE.MeshStandardMaterial({ color: ropeColors[i], emissive: ropeColors[i], emissiveIntensity: 0.3 }),
      );
      rope.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      rope.rotation.z = Math.PI / 2;
      rope.rotation.y = Math.atan2(z2 - z1, x2 - x1) * -1;
      scene.add(rope);
    }
  }

  // Robot: p1 ở -z nhìn về +z, p2 ở +z quay mặt lại
  const robots = { p1: new Robot(0x2f7bff), p2: new Robot(0xd93030) };
  robots.p1.root.position.z = -GAP;
  robots.p2.root.position.z = GAP;
  robots.p2.root.rotation.y = Math.PI;
  scene.add(robots.p1.root, robots.p2.root);

  // Tia lửa
  const sparks = [];
  const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true }));
    m.visible = false;
    scene.add(m);
    sparks.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
  }
  function burst(pos, color, count = 18) {
    let n = 0;
    for (const s of sparks) {
      if (s.life > 0) continue;
      s.mesh.position.copy(pos);
      s.mesh.material.color.set(color);
      s.vel.set((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6);
      s.life = 0.35 + Math.random() * 0.2;
      s.mesh.visible = true;
      if (++n >= count) break;
    }
  }

  let shake = 0;
  on('ANIM', ({ who, name }) => robots[who].play(name));
  on('HIT', ({ attacker, target, blocked, kind }) => {
    const pos = blocked ? robots[target].gloveWorld('L').lerp(robots[target].gloveWorld('R'), 0.5) : robots[target].headWorld();
    burst(pos, blocked ? 0x9fd8ff : 0xffaa33, blocked ? 10 : 22);
    shake = Math.max(shake, blocked ? 0.05 : kind === 'hook' ? 0.22 : 0.14);
    if (attacker === 'p2' && !blocked) shake += 0.08; // bị đánh trúng thì rung mạnh hơn
  });
  on('ROUND', ({ state }) => {
    if (state === 'ko') shake = 0.4;
  });

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // màn hình dọc thì lùi camera ra xa hơn
    camera.fov = w < h ? 75 : 55;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function update(dt, now) {
    robots.p1.update(dt, now);
    robots.p2.update(dt, now);

    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.material.opacity = Math.max(0, s.life * 2.5);
      if (s.life <= 0) s.mesh.visible = false;
    }

    shake *= Math.exp(-dt * 8);
    camera.position.copy(camBase).add(
      new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0),
    );
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  }

  return { update, robots };
}
