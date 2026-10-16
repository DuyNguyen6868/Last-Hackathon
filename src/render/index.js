import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildStage } from './stage.js';
import { createRobot } from './robot.js';
import { playAnim, playWindup } from './anim.js';
import { Effects } from './effects.js';
import { Tweens } from './tween.js';
import { initAudio, sfx } from './audio.js';

/**
 * Khởi tạo phần hiển thị 3D.
 *   bus: { on(type, fn), emit(type, payload) }  (event bus của dự án)
 *   container: phần tử chứa canvas (mặc định document.body, canvas phủ kín)
 *   bloom: tắt (false) nếu máy demo yếu
 * Lắng nghe: ANIM, HIT, ROUND. Không phát event nào.
 */
export function initRender({ container = document.body, bus, bloom = true } = {}) {
  if (!bus?.on) throw new Error('initRender cần { bus } có hàm on(type, fn)');

  const isBody = container === document.body;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.style.cssText = `position:${isBody ? 'fixed' : 'absolute'};inset:0;width:100%;height:100%;display:block;`;
  if (!isBody && getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.prepend(canvas);

  const { scene, camera, rig } = buildStage(renderer);

  // Robot: p1 ở gần camera nhìn về -z, p2 ở xa nhìn về +z
  const robots = { p1: createRobot('p1'), p2: createRobot('p2') };
  robots.p1.group.position.set(-0.55, 0, 2.2);
  robots.p1.group.rotation.y = Math.PI;
  robots.p2.group.position.set(0.55, 0, -2.2);
  scene.add(robots.p1.group, robots.p2.group);

  const tweens = new Tweens();
  const fx = new Effects(scene, camera);

  // Hậu kỳ: bloom cho phần phát sáng
  let composer = null;
  if (bloom) {
    const target = new THREE.WebGLRenderTarget(2, 2, { samples: 4, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(2, 2), 0.55, 0.45, 1.0));
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = isBody ? window.innerWidth : container.clientWidth;
    const h = isBody ? window.innerHeight : container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(isBody ? document.documentElement : container);
  resize();

  const stopAudio = initAudio();

  // --- Sự kiện từ game ---
  const v = new THREE.Vector3();
  let slowLeft = 0;     // ms thực còn lại của slow-motion khi KO
  let pushTarget = 0;   // camera áp sát robot bị KO
  let push = 0;
  let pushPoint = new THREE.Vector3();
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const moves = {
    p1: { vision: { x: 0, z: 0 }, keyboard: { x: 0, z: 0 }, keyboardActive: false },
    p2: { ai: { x: 0, z: 0 } },
  };
  const move = { x: 0, z: 0 };
  let movementEnabled = false;

  bus.on('MOVE', ({ who, x = 0, z = 0, source = 'vision', active = true }) => {
    if (who === 'p1') {
      const input = source === 'keyboard' ? moves.p1.keyboard : moves.p1.vision;
      input.x = Math.max(-1, Math.min(1, x));
      input.z = Math.max(-1, Math.min(1, z));
      if (source === 'keyboard') moves.p1.keyboardActive = active;
      const selected = moves.p1.keyboardActive ? moves.p1.keyboard : moves.p1.vision;
      move.x = selected.x;
      move.z = selected.z;
    } else if (who === 'p2') {
      moves.p2.ai.x = Math.max(-1, Math.min(1, x));
      moves.p2.ai.z = Math.max(-1, Math.min(1, z));
    }
  });

  bus.on('ANIM', ({ who, name }) => {
    const r = robots[who];
    if (!r) return;
    const wasKo = r.ko;
    playAnim(r, name, tweens);
    if (name.startsWith('jab') || name.startsWith('hook')) {
      sfx.whoosh();
      r.clearCharge(name.slice(-1));
    }
    if (['idle', 'hit', 'ko', 'reset'].includes(name)) r.clearCharge();
    if (name === 'ko' && !wasKo) {
      sfx.ko();
      fx.shake(0.3);
      slowLeft = 1400;
      pushTarget = 1;
      r.chestAnchor.getWorldPosition(pushPoint);
      later(2400, () => { pushTarget = 0; });
    }
  });

  bus.on('HIT', ({ target, damage = 5, blocked = false }) => {
    const r = robots[target];
    if (!r) return;
    const strength = Math.min(1, damage / 12);
    r.chestAnchor.getWorldPosition(v);
    const facing = new THREE.Vector3(0, 0, target === 'p1' ? -1 : 1);
    if (blocked) {
      fx.burst(v, 0x9be8ff, 14, 3, facing);
      fx.ring(v, 0x9be8ff);
      fx.shake(0.03);
      r.flashColor.set(0xbfefff);
      r.flash = 0.7;
      sfx.block();
    } else {
      fx.burst(v, 0xffb04a, 26 + Math.round(damage * 2), 5 + strength * 3, facing);
      fx.burst(v, r.glowColor, 12, 4, facing);
      fx.ring(v, 0xffd9a0);
      fx.shake(0.07 + strength * 0.2);
      r.flashColor.set(0xff2a3d);
      r.flash = 1;
      sfx.punch(strength);
    }
  });

  // Đối thủ lấy đà trước khi đấm: kéo găng về sau, găng sáng cam, tiếng nạp lực
  bus.on('TELEGRAPH', ({ who, hand, kind, ms }) => {
    const r = robots[who];
    if (!r || r.ko) return;
    playWindup(r, hand, kind, ms, tweens);
    r.telegraph(hand, ms, performance.now());
    sfx.charge(ms / 1000);
  });

  // Combo / phản đòn trúng: tia lửa vàng, 2 vòng xung kích, rung mạnh
  bus.on('COMBO', ({ target, name }) => {
    const r = robots[target];
    if (!r) return;
    r.chestAnchor.getWorldPosition(v);
    const at = v.clone();
    fx.burst(at, 0xffd23f, 45, 7);
    fx.ring(at, 0xffd23f);
    later(90, () => fx.ring(at, 0xffffff));
    fx.shake(name.includes('STORM') ? 0.38 : 0.22);
    sfx.combo();
  });

  // state theo game.js: countdown -> fight -> end | ko -> over (cũng nhận 'start' theo HUONG_DAN.md)
  bus.on('ROUND', ({ state }) => {
    if (state === 'countdown' || state === 'start') {
      movementEnabled = false;
      move.x = 0;
      move.z = 0;
      moves.p1.keyboardActive = false;
      moves.p2.ai = { x: 0, z: 0 };
      robots.p1.group.position.set(-0.55, 0, 2.2);
      robots.p2.group.position.set(0.55, 0, -2.2);
      for (const r of Object.values(robots)) {
        tweens.cancelTargets(r.targets);
        r.reset();
      }
      slowLeft = 0;
      pushTarget = 0;
      if (state === 'start') sfx.bell(1);
    } else if (state === 'fight') {
      movementEnabled = true;
      sfx.bell(1);
    } else if (state === 'end') {
      movementEnabled = false;
      move.x = 0;
      move.z = 0;
      sfx.bell(3);
    } else if (state === 'ko') {
      movementEnabled = false;
      move.x = 0;
      move.z = 0;
      later(900, () => sfx.bell(3));
    }
  });

  // --- Vòng lặp ---
  let last = performance.now();
  const base = new THREE.Vector3();
  const look = new THREE.Vector3();
  function frame(now) {
    const real = Math.min(now - last, 50);
    last = now;
    let scale = 1;
    if (slowLeft > 0) {
      slowLeft -= real;
      scale = slowLeft > 300 ? 0.25 : 0.25 + 0.75 * (1 - slowLeft / 300);
    }
    const dt = real * scale;

    tweens.update(dt);
    const p1 = robots.p1;
    const moveLength = movementEnabled ? Math.hypot(move.x, move.z) : 0;
    if (moveLength > 0) {
      const scale = Math.min(1, moveLength);
      p1.group.position.x += (move.x / moveLength) * 2.1 * scale * real / 1000;
      p1.group.position.z += (move.z / moveLength) * 2.1 * scale * real / 1000;
      p1.group.position.x = THREE.MathUtils.clamp(p1.group.position.x, -3.4, 3.4);
      p1.group.position.z = THREE.MathUtils.clamp(p1.group.position.z, 0.2, 4.2);
    }
    p1.setWalking(moveLength);
    const p2 = robots.p2;
    const enemyMove = movementEnabled ? moves.p2.ai : { x: 0, z: 0 };
    const enemyMoveLength = Math.hypot(enemyMove.x, enemyMove.z);
    if (enemyMoveLength > 0) {
      p2.group.position.x += (enemyMove.x / enemyMoveLength) * 1.7 * real / 1000;
      p2.group.position.z += (enemyMove.z / enemyMoveLength) * 1.7 * real / 1000;
      p2.group.position.x = THREE.MathUtils.clamp(p2.group.position.x, -3.4, 3.4);
      p2.group.position.z = THREE.MathUtils.clamp(p2.group.position.z, -4.2, -0.2);
    }
    p2.setWalking(enemyMoveLength);
    const faceP1 = new THREE.Vector2(p1.group.position.x - p2.group.position.x, p1.group.position.z - p2.group.position.z);
    p2.group.rotation.y = Math.atan2(faceP1.x, faceP1.y);
    const faceP2 = new THREE.Vector2(p2.group.position.x - p1.group.position.x, p2.group.position.z - p1.group.position.z);
    p1.group.rotation.y = Math.atan2(faceP2.x, faceP2.y);
    bus.emit('POSITION', {
      p1: { x: p1.group.position.x, z: p1.group.position.z },
      p2: { x: p2.group.position.x, z: p2.group.position.z },
    });
    for (const r of Object.values(robots)) r.update(dt, now);
    fx.update(dt);

    push += (pushTarget - push) * Math.min(1, real / 300);
    const t = now * 0.001;
    base.copy(rig.pos);
    base.x += Math.sin(t * 0.35) * 0.18;
    base.y += Math.sin(t * 0.27) * 0.05;
    base.lerp(look.copy(pushPoint).add(new THREE.Vector3(0, 0.6, 2.8)), 0.0 + 0.55 * push * (pushPoint.z < 0 ? 1 : 0.4));
    camera.position.copy(base).add(fx.shakeOffset);
    look.copy(rig.target).lerp(pushPoint, 0.6 * push);
    camera.lookAt(look);

    (composer || renderer).render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  return {
    scene, camera, robots, renderer,
    dispose() {
      renderer.setAnimationLoop(null);
      timers.forEach(clearTimeout);
      ro.disconnect();
      stopAudio();
      fx.dispose();
      composer?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
