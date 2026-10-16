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
  dodgeWindowMs: 650, // né chỉ có hiệu lực trong khoảng này sau khi bắt đầu né
  damage: { jab: 5, hook: 10 },
  guardMultiplier: 0.2,

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
    dodgeOn: 0.35, // mũi lệch khỏi vị trí gốc, tính theo bề rộng vai
    dodgeOff: 0.2,
  },
};
