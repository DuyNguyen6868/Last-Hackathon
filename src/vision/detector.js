// Nhận diện hành động từ pose (Chiến). Hàm thuần, không đụng DOM, dễ thử nghiệm.
// - world landmarks (mét, gốc ở hông) dùng cho đấm: tỉ lệ duỗi tay và tốc độ cổ tay
// - image landmarks (0..1) dùng cho đỡ và né: so sánh theo bề rộng vai nên không phụ thuộc khoảng cách
import { CONFIG } from '../config.js';

const LM = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
};
const USED = Object.values(LM);

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const len = (v) => Math.hypot(v.x, v.y, v.z);
const dist = (a, b) => len(sub(a, b));
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ActionDetector {
  constructor(emit, who = 'p1') {
    this.emit = emit;
    this.who = who;
    this.cfg = CONFIG.vision;
    this.world = null; // world landmarks đã làm mượt
    this.prevWrist = { L: null, R: null };
    this.armed = { L: true, R: true }; // true khi tay đã co lại, sẵn sàng đấm tiếp
    this.lastPunch = { L: 0, R: 0 };
    this.guard = false;
    this.dodge = null;
    this.noseBase = null; // vị trí mũi lúc đứng thủ thế, tự cập nhật chậm
    this.debug = {};
    this.move = { x: 0, z: 0 };
    this.moveCalibration = { values: [] };
  }

  smooth(raw) {
    const a = this.cfg.smoothing;
    if (!this.world) {
      this.world = raw.map((p) => ({ ...p }));
      return;
    }
    for (const i of USED) {
      const s = this.world[i];
      const r = raw[i];
      s.x = s.x * a + r.x * (1 - a);
      s.y = s.y * a + r.y * (1 - a);
      s.z = s.z * a + r.z * (1 - a);
      s.visibility = r.visibility;
    }
  }

  update(image, worldRaw, now) {
    if (!image || !worldRaw) return;
    this.smooth(worldRaw);
    const dt = this.lastT ? Math.max((now - this.lastT) / 1000, 1 / 120) : 1 / 30;
    this.lastT = now;

    // Trong MediaPipe, "left" là tay trái của người chơi
    this.detectPunch('L', LM.lShoulder, LM.lElbow, LM.lWrist, LM.rShoulder, dt, now);
    this.detectPunch('R', LM.rShoulder, LM.rElbow, LM.rWrist, LM.lShoulder, dt, now);
    this.detectGuardAndDodge(image);
    this.detectMovement(image);
  }

  detectMovement(img) {
    const required = [LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip, LM.lKnee, LM.rKnee, LM.lAnkle, LM.rAnkle];
    if (required.some((i) => !img[i] || (img[i].visibility ?? 0) < this.cfg.movement.minLandmarkVisibility)) {
      this.setMove(0, 0);
      this.debug.move = 'cần thấy chân';
      return;
    }

    const shoulderWidth = dist2d(img[LM.lShoulder], img[LM.rShoulder]);
    if (shoulderWidth < 0.08) {
      this.setMove(0, 0);
      this.debug.move = 'đứng xa';
      return;
    }

    const hipX = (img[LM.lHip].x + img[LM.rHip].x) / 2;
    const shoulderZ = (this.world[LM.lShoulder].z + this.world[LM.rShoulder].z) / 2;
    const hipZ = (this.world[LM.lHip].z + this.world[LM.rHip].z) / 2;
    const lean = (shoulderZ - hipZ) / Math.max(0.2, dist(this.world[LM.lShoulder], this.world[LM.rShoulder]));

    if (this.moveCalibration.values.length < this.cfg.calibrationFrames) {
      this.moveCalibration.values.push({ x: hipX, z: lean });
      this.setMove(0, 0);
      if (this.moveCalibration.values.length === this.cfg.calibrationFrames) {
        const values = this.moveCalibration.values;
        this.moveBase = {
          x: values.reduce((sum, p) => sum + p.x, 0) / values.length,
          z: values.reduce((sum, p) => sum + p.z, 0) / values.length,
        };
        this.moveCalibration.values = [];
      }
      this.debug.move = `hiệu chỉnh ${this.moveCalibration.values.length || this.cfg.calibrationFrames}/${this.cfg.calibrationFrames}`;
      return;
    }

    // Lật dấu vì webcam hiển thị như gương và p1 quay lưng về camera.
    const rawX = (this.moveBase.x - hipX) / shoulderWidth;
    const rawZ = lean - this.moveBase.z;
    const deadZone = (value, start, full) => {
      const magnitude = Math.abs(value);
      return magnitude <= start ? 0 : Math.sign(value) * Math.min(1, (magnitude - start) / (full - start));
    };
    const x = deadZone(rawX, this.cfg.movement.deadZone, this.cfg.movement.fullLean);
    // Lean về camera làm z MediaPipe âm; p1 cũng tiến về phía trước theo trục z âm.
    const z = deadZone(rawZ, this.cfg.movement.forwardDeadZone, this.cfg.movement.fullForward);
    const smoothing = this.cfg.movement.smoothing;
    this.setMove(this.move.x * (1 - smoothing) + x * smoothing, this.move.z * (1 - smoothing) + z * smoothing);
    this.debug.move = `ngang ${this.move.x.toFixed(1)} · tới/lùi ${this.move.z.toFixed(1)}`;
  }

  setMove(x, z) {
    if (Math.abs(x - this.move.x) < 0.035 && Math.abs(z - this.move.z) < 0.035) return;
    this.move = { x, z };
    this.emit('MOVE', { who: this.who, x, z, source: 'vision' });
  }

  detectPunch(hand, iS, iE, iW, iOtherS, dt, now) {
    const w = this.world;
    const [S, E, W, OS] = [w[iS], w[iE], w[iW], w[iOtherS]];
    if (W.visibility < this.cfg.minVisibility || E.visibility < this.cfg.minVisibility) {
      this.prevWrist[hand] = null;
      return;
    }

    const armLen = dist(S, E) + dist(E, W);
    const ext = dist(S, W) / armLen;
    const prev = this.prevWrist[hand];
    this.prevWrist[hand] = { x: W.x, y: W.y, z: W.z };
    if (!prev) return;
    if (dt > 0.12) return; // bỏ vận tốc giả khi webcam khựng hoặc tay vừa xuất hiện lại

    const v = { x: (W.x - prev.x) / dt, y: (W.y - prev.y) / dt, z: (W.z - prev.z) / dt };
    const speed = len(v);
    // tốc độ theo phương ngang hướng về phía vai bên kia (cú hook quét vào giữa)
    const across = sub(OS, S);
    const acrossLen = Math.hypot(across.x, across.z) || 1;
    const hookSpeed = (v.x * across.x + v.z * across.z) / acrossLen;
    const elbowHigh = Math.abs(E.y - S.y) < this.cfg.hookElbowHeight;

    this.debug[hand] = { ext: ext.toFixed(2), speed: speed.toFixed(1), hook: hookSpeed.toFixed(1) };

    if (ext < this.cfg.extendOff) this.armed[hand] = true;
    if (!this.armed[hand] || this.guard) return;
    if (now - this.lastPunch[hand] < CONFIG.punchCooldownMs) return;

    let kind = null;
    if (elbowHigh && hookSpeed > this.cfg.hookSpeed) kind = 'hook';
    else if (ext > this.cfg.extendOn && speed > this.cfg.jabSpeed) kind = 'jab';
    if (!kind) return;

    this.armed[hand] = false;
    this.lastPunch[hand] = now;
    const ref = kind === 'hook' ? this.cfg.hookSpeed : this.cfg.jabSpeed;
    const power = Math.min(1, (kind === 'hook' ? hookSpeed : speed) / (ref * 2.5));
    this.emit('PUNCH', { who: this.who, hand, kind, power });
  }

  detectGuardAndDodge(img) {
    const nose = img[LM.nose];
    const lS = img[LM.lShoulder];
    const rS = img[LM.rShoulder];
    const shoulderW = dist2d(lS, rS) || 0.2;

    if ([nose, lS, rS, img[LM.lWrist], img[LM.rWrist]].some((p) => !p || (p.visibility ?? 1) < 0.35)) {
      if (this.guard) this.emit('GUARD', { who: this.who, on: false });
      if (this.dodge !== null) this.emit('DODGE', { who: this.who, dir: null });
      this.guard = false;
      this.dodge = null;
      this.debug.guard = '—';
      this.debug.dodge = '—';
      return;
    }

    const calibrating = this.calibration && this.calibration.values.length < this.cfg.calibrationFrames;
    if (calibrating) {
      this.calibration.values.push(nose.x);
      if (this.calibration.values.length === this.cfg.calibrationFrames) {
        this.noseBase = { x: this.calibration.values.reduce((a, b) => a + b, 0) / this.calibration.values.length };
        this.calibration = null;
      }
    }

    // Đỡ: cả hai cổ tay ở gần mặt
    const dL = dist2d(img[LM.lWrist], nose) / shoulderW;
    const dR = dist2d(img[LM.rWrist], nose) / shoulderW;
    const guardNow = this.guard
      ? Math.max(dL, dR) < this.cfg.guardOff
      : Math.max(dL, dR) < this.cfg.guardOn;
    if (guardNow !== this.guard) {
      this.guard = guardNow;
      this.emit('GUARD', { who: this.who, on: guardNow });
    }

    // Né: mũi lệch khỏi vị trí gốc. Ảnh gốc chưa lật gương nên x tăng = người chơi nghiêng sang TRÁI của họ
    this.noseBase ??= { x: nose.x };
    const dx = (nose.x - this.noseBase.x) / shoulderW;
    let dodgeNow = this.dodge;
    if (this.dodge === null) {
      if (!this.calibration && dx > this.cfg.dodgeOn) dodgeNow = 'L';
      else if (!this.calibration && dx < -this.cfg.dodgeOn) dodgeNow = 'R';
      // chỉ cập nhật vị trí gốc khi đang đứng yên, để theo kịp người chơi di chuyển
      this.noseBase.x += (nose.x - this.noseBase.x) * 0.01;
    } else if (Math.abs(dx) < this.cfg.dodgeOff) {
      dodgeNow = null;
    }
    if (dodgeNow !== this.dodge) {
      this.dodge = dodgeNow;
      this.emit('DODGE', { who: this.who, dir: dodgeNow });
    }

    this.debug.guard = `${dL.toFixed(2)}/${dR.toFixed(2)}`;
    this.debug.dodge = dx.toFixed(2);
  }

  recalibrate() {
    this.noseBase = null;
    this.calibration = { values: [] };
    this.moveCalibration = { values: [] };
    this.moveBase = null;
  }

  lost() {
    if (this.guard) this.emit('GUARD', { who: this.who, on: false });
    if (this.dodge !== null) this.emit('DODGE', { who: this.who, dir: null });
    this.guard = false;
    this.dodge = null;
    this.prevWrist = { L: null, R: null };
    this.setMove(0, 0);
  }

  get isCalibrating() {
    return Boolean(this.calibration || this.moveCalibration.values.length);
  }

  get calibrationProgress() {
    return this.moveCalibration.values.length;
  }
}
