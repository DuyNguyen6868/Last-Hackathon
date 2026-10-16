import * as THREE from 'three';

// Tia lửa (Points cộng sáng), vòng sóng xung kích và rung camera.
export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.shakeAmp = 0;
    this.shakeOffset = new THREE.Vector3();

    const max = (this.max = 500);
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.1, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.1, 0.16, 40);
  }

  // bias: hướng ưu tiên bắn ra (THREE.Vector3), nếu có
  burst(origin, color, count, speed, bias) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
      if (bias) dir.addScaledVector(bias, 0.8).normalize();
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pos.set([origin.x, origin.y, origin.z], i * 3);
      this.vel.set([dir.x * s, dir.y * s, dir.z * s], i * 3);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.maxLife[i] = this.life[i] = 0.3 + Math.random() * 0.4;
    }
  }

  ring(origin, color) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.copy(origin);
    mesh.lookAt(this.camera.position);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0 });
  }

  shake(amp) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    for (let i = 0; i < this.max; i++) {
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i3 + 1] -= 9 * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i3] = this.base[i3] * k;
      this.col[i3 + 1] = this.base[i3 + 1] * k;
      this.col[i3 + 2] = this.base[i3 + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (const r of this.rings) {
      r.t += dtMs;
      const k = r.t / 320;
      r.mesh.scale.setScalar(1 + k * 14);
      r.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    }
    this.rings = this.rings.filter((r) => {
      if (r.t < 320) return true;
      this.scene.remove(r.mesh);
      r.mesh.material.dispose();
      return false;
    });

    this.shakeAmp *= Math.exp(-dtMs / 120);
    if (this.shakeAmp < 0.001) this.shakeAmp = 0;
    this.shakeOffset.set(
      (Math.random() - 0.5) * 2 * this.shakeAmp,
      (Math.random() - 0.5) * 2 * this.shakeAmp,
      0,
    );
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.ringGeo.dispose();
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.material.dispose();
    }
  }
}
