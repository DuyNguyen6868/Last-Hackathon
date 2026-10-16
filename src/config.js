// Mọi con số cân bằng game và ngưỡng nhận diện nằm ở đây để cả nhóm chỉnh cho dễ.
export const CONFIG = {
  // Game (Duy)
  maxHP: 100,
  rounds: 3,
  roundSeconds: 60,
  countdownMs: 2500,
  betweenRoundsMs: 6000,
  matchEndDelayMs: 1800,
  hitDelayMs: 250, // từ lúc ra đòn tới lúc tính trúng, để đối phương kịp đỡ/né
  punchCooldownMs: 350,
  hitStunMs: 220, // bị trúng đòn thì không ra đòn được trong khoảng này
  dodgeWindowMs: 1000, // né chỉ có hiệu lực trong khoảng này sau khi bắt đầu né (phải dài hơn windupMs + hitDelayMs của AI)
  damage: { jab: 5, hook: 10 },
  hitRange: { jab: 2.15, hook: 2.45 },
  guardMultiplier: 0.2,

  // Combo: các đòn liên tiếp, đổi tay luân phiên, mỗi đòn cách nhau không quá comboGapMs.
  // Đòn cuối phải trúng (không bị đỡ hay né). Combo dài được ưu tiên hơn combo ngắn.
  // Thưởng cộng dồn theo từng bước: J→K→U→I lần lượt kích hoạt ONE-TWO, TRIPLE THREAT, STEEL STORM
  // (cả chuỗi trúng hết ≈ 43 sát thương, so với 30 nếu không có combo).
  comboGapMs: 900,
  combos: [
    { name: 'ONE-TWO', seq: ['jab', 'jab'], bonus: 2 },
    { name: 'HAMMER', seq: ['hook', 'hook'], bonus: 5 },
    { name: 'TRIPLE THREAT', seq: ['jab', 'jab', 'hook'], bonus: 4, stunMs: 400 },
    { name: 'STEEL STORM', seq: ['jab', 'jab', 'hook', 'hook'], bonus: 7, stunMs: 600 },
  ],
  // Phản đòn: vừa né hoặc đỡ thành công thì đòn trúng tiếp theo trong khoảng này được nhân sát thương
  counterWindowMs: 900,
  counterMultiplier: 1.5,

  // Vision (Chiến): các ngưỡng tính trên world landmarks (đơn vị mét)
  vision: {
    minVisibility: 0.5,
    smoothing: 0.5, // EMA: càng lớn càng mượt nhưng trễ hơn
    extendOn: 0.86, // tỉ lệ duỗi tay (vai→cổ tay / tổng chiều dài tay) để tính là ra đòn
    extendOff: 0.72, // phải co tay dưới mức này mới đấm được cú tiếp theo
    jabSpeed: 1.1, // m/s
    hookSpeed: 1.6, // m/s theo phương ngang hướng vào giữa người
    hookElbowHeight: 0.14, // khuỷu tay cao gần bằng vai (m)
    guardOn: 0.75, // khoảng cách cổ tay → mũi, tính theo bề rộng vai
    guardOff: 0.95,
    dodgeOn: 0.28, // mũi lệch khỏi vị trí gốc, tính theo bề rộng vai
    dodgeOff: 0.16,
    calibrationFrames: 24,
    range: { shoulderWidthMin: 0.12, shoulderWidthMax: 0.48 },
    movement: { minLandmarkVisibility: 0.45, deadZone: 0.12, fullLean: 0.42, forwardDeadZone: 0.11, fullForward: 0.38, smoothing: 0.38 },
  },
};
