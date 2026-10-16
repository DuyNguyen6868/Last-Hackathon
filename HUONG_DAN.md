# 🥊 Reel Steel: Hướng dẫn hackathon (4 tiếng)

> **Ý tưởng:** Người chơi đứng trước webcam đấm, robot trên màn hình đấm theo (shadow boxing kiểu phim *Real Steel*), đấu với một robot do AI điều khiển.

**Thành viên:** Duy (trưởng nhóm) · Chiến · Thành · Tiến Anh

---

## Mục lục
1. [Phạm vi: làm gì, bỏ gì](#1-phạm-vi-làm-gì-bỏ-gì)
2. [Tech stack](#2-tech-stack)
3. [Cài đặt và chạy](#3-cài-đặt-và-chạy)
4. [Cấu trúc thư mục và quy tắc Git](#4-cấu-trúc-thư-mục-và-quy-tắc-git)
5. [Format sự kiện (KHÔNG ĐƯỢC ĐỔI sau phút 20)](#5-format-sự-kiện-không-được-đổi-sau-phút-20)
6. [Phân công](#6-phân-công)
7. [Timeline](#7-timeline)
8. [Ghi chú kỹ thuật cho từng phần](#8-ghi-chú-kỹ-thuật-cho-từng-phần)
9. [Rủi ro và cách xử lý](#9-rủi-ro-và-cách-xử-lý)
10. [Checklist demo](#10-checklist-demo)
11. [Repo tham khảo](#11-repo-tham-khảo)

---

## 1. Phạm vi: làm gì, bỏ gì

| Hạng mục | Mức | Ghi chú |
|---|---|---|
| Nhận diện đấm trái/phải, đỡ, né qua webcam | ✅ **MVP** | MediaPipe Pose và vài luật đơn giản, không cần train model |
| Đấu trường 3D, 2 robot dựng từ hình khối | ✅ **MVP** | Không tải model ngoài |
| Đối thủ AI dùng máy trạng thái (FSM) | ✅ **MVP** | |
| Máu, hiệp, KO | ✅ **MVP** | |
| Điều khiển bằng bàn phím | ✅ **MVP** | Để dev song song và làm dự phòng khi demo |
| Hiệu ứng trúng đòn, âm thanh, rung camera | 🟡 Nên có | |
| LLM bình luận viên / huấn luyện viên giữa hiệp | 🟡 Nếu kịp | Điểm cộng cho chủ đề "AI thực chiến" |
| Combo (jab-jab-hook), 3 mức khó, 2 người chơi | 🟡 Nếu kịp | |
| Ragdoll vật lý, robot tự học bằng RL, robot thật | ❌ **Bỏ** | Không đủ thời gian |

**MVP phải chạy được:** đấm trước webcam thì robot đánh, đối thủ AI đánh lại, máu giảm, có KO.

---

## 2. Tech stack

| Lớp | Công nghệ |
|---|---|
| Khung dự án | Vite và JavaScript thuần |
| Vision | [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) (PoseLandmarker, chạy trong trình duyệt) |
| Hiển thị 3D | [Three.js](https://threejs.org/), robot dựng từ `BoxGeometry` và `CylinderGeometry` |
| Logic game | Vòng lặp `requestAnimationFrame` và một event bus tự viết |
| Đối thủ AI | FSM có trọng số ngẫu nhiên |
| LLM (tuỳ chọn) | Claude API (`claude-haiku-5-5`) qua proxy Express nhỏ trong `server/` |
| Deploy | Vercel hoặc GitHub Pages (chỉ frontend) |

> **Phương án dự phòng** nếu JS gặp khó: Python 3.12 với `opencv-python`, `mediapipe` và `pygame` làm game 2D. Chỉ chuyển trong 30 phút đầu, sau đó không đổi nữa.

---

## 3. Cài đặt và chạy

Yêu cầu: Node 20 trở lên, Chrome hoặc Edge, máy có webcam.

**Duy làm một lần lúc khởi động:**
```bash
npm create vite@latest . -- --template vanilla
npm install three @mediapipe/tasks-vision
mkdir -p src/vision src/render src/game src/ai server
git add . && git commit -m "Scaffold project" && git push
```

**Mọi người:**
```bash
git clone <repo-url> && cd Last-Hackathon
npm install
npm run dev        # mở http://localhost:5173 và cho phép dùng webcam
```

**Proxy LLM (chỉ Tiến Anh, tuỳ chọn):**
```bash
cd server && npm init -y && npm install express cors @anthropic-ai/sdk dotenv
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # KHÔNG commit file .env
node index.js
```

---

## 4. Cấu trúc thư mục và quy tắc Git

```
src/
  main.js          # Duy: khởi tạo và nối các module
  events.js        # Duy: event bus (on/emit)
  input/keyboard.js# Duy: điều khiển bằng bàn phím
  game/            # Duy: game state, luật trúng đòn, HUD
  vision/          # Chiến: webcam, pose, nhận diện hành động
  render/          # Thành: scene, robot, animation, hiệu ứng, âm thanh
  ai/              # Tiến Anh: FSM đối thủ, client gọi LLM
server/            # Tiến Anh: proxy Claude API
```

**Quy tắc Git:**
- Mỗi người làm trên nhánh riêng: `duy/game`, `chien/vision`, `thanh/render`, `tienanh/ai`.
- **Chỉ sửa file trong thư mục của mình.** Muốn sửa `main.js` hoặc `events.js` thì báo Duy.
- Commit nhỏ và thường xuyên, pull `main` mỗi 30 phút.
- Merge vào `main` tại các mốc ghép trong Timeline. Duy là người review và merge.
- Từ 3:15 trở đi chỉ được merge commit sửa bug.

---

## 5. Format sự kiện (KHÔNG ĐƯỢC ĐỔI sau phút 20)

Mọi module chỉ giao tiếp với nhau qua event bus. Vision và bàn phím phát **cùng một kiểu sự kiện**, nên game không cần biết input đến từ đâu.

```js
// src/events.js
const handlers = {};
export const on   = (type, fn) => (handlers[type] ??= []).push(fn);
export const emit = (type, payload = {}) => (handlers[type] || []).forEach(fn => fn(payload));
```

**Input → Game** (từ Vision, Keyboard, hoặc AI cho đối thủ):

| Event | Payload | Ý nghĩa |
|---|---|---|
| `PUNCH` | `{ who: 'p1'\|'p2', hand: 'L'\|'R', kind: 'jab'\|'hook', power: 0..1 }` | Ra đòn |
| `GUARD` | `{ who, on: true\|false }` | Bật/tắt đỡ |
| `DODGE` | `{ who, dir: 'L'\|'R'\|null }` | Né sang trái/phải, `null` là về giữa |

**Game → Render / HUD:**

| Event | Payload | Ý nghĩa |
|---|---|---|
| `ANIM` | `{ who, name: 'jab_L'\|'jab_R'\|'hook_L'\|'hook_R'\|'guard'\|'dodge_L'\|'dodge_R'\|'hit'\|'ko'\|'idle' }` | Chạy animation |
| `HIT` | `{ target, damage, blocked: bool }` | Trúng đòn, dùng cho hiệu ứng và âm thanh |
| `HP` | `{ p1: 0..100, p2: 0..100 }` | Cập nhật thanh máu |
| `ROUND` | `{ round, state: 'start'\|'end'\|'ko', winner? }` | Trạng thái hiệp |

**Phím mặc định (p1):** `J` jab trái · `K` jab phải · `U` hook trái · `I` hook phải · `L` giữ để đỡ · `A`/`D` né.

---

## 6. Phân công

### 👑 Duy: trưởng nhóm, ghép code và logic game
- [ ] Khung dự án, `events.js`, `keyboard.js`, `main.js`
- [ ] Game state: máu, hiệp (60 giây/hiệp, 3 hiệp), KO
- [ ] Luật trúng đòn: đòn mất 250ms mới chạm. Đối phương đỡ thì sát thương ×0.2, né đúng hướng thì trượt
- [ ] Sát thương: jab 5, hook 10, nhân thêm theo `power`
- [ ] HUD: thanh máu, đồng hồ, màn hình "ROUND 1 / FIGHT! / KO"
- [ ] Review và merge, chủ trì 2 lần ghép code

### 👁️ Chiến: vision
- [ ] Bật webcam và chạy PoseLandmarker ở chế độ `VIDEO`
- [ ] Hiệu chỉnh 3 giây đầu: đo chiều dài tay và vị trí đứng thủ thế
- [ ] Làm mượt tín hiệu (EMA), nhận ra **đấm, đỡ, né** rồi `emit` theo format ở mục 5
- [ ] Overlay khung xương lên video nhỏ ở góc màn hình (đẹp khi demo)
- [ ] Chỉnh ngưỡng với **cả 4 người trong nhóm** và ở nhiều mức ánh sáng

### 🤖 Thành: 3D và hiệu ứng
- [ ] Scene: sàn đài, 4 cột và dây đài, đèn spotlight, camera sau lưng p1 hơi chéo
- [ ] Hàm `createRobot(color)` gồm thân, đầu, 2 tay (vai, khuỷu, găng); p1 màu xanh, p2 màu đỏ
- [ ] Animation bằng tween đơn giản (lerp), lắng nghe `ANIM`
- [ ] Hiệu ứng khi `HIT`: tia lửa, rung camera, đèn robot nháy đỏ
- [ ] Âm thanh: tiếng đấm, đỡ, chuông, KO (lấy từ freesound hoặc mixkit)

### 🧠 Tiến Anh: đối thủ AI, LLM và pitch
- [ ] FSM cho p2 với các trạng thái `IDLE → APPROACH → ATTACK / GUARD / DODGE → RECOVER`
- [ ] Phản ứng theo p1: p1 vừa đấm thì có xác suất đỡ hoặc né. p1 đang đỡ lâu thì dùng hook
- [ ] 3 mức khó (Easy/Normal/Hard) bằng cách đổi tốc độ phản ứng và xác suất
- [ ] *(Nếu kịp)* `server/` proxy Claude: giữa hiệp gửi số liệu (số đòn, tỉ lệ trúng, máu), nhận về 1–2 câu bình luận và hiện lên màn hình
- [ ] Slide pitch (5–6 slide), kịch bản demo, **quay video dự phòng** lúc 3:30

---

## 7. Timeline

T = giờ bắt đầu. Đặt báo thức cho từng mốc.

| Mốc | Duy | Chiến | Thành | Tiến Anh |
|---|---|---|---|---|
| **0:00–0:20** | Cả nhóm đọc file này, chốt phạm vi và format sự kiện. Duy push khung dự án | | | |
| **0:20–1:00** | Event bus, bàn phím, máu | Hiện khung xương trên webcam | Đấu trường và robot đứng yên | Khung FSM, log ra console |
| **1:00–2:00** | Luật trúng đòn, KO, HUD | Nhận diện đấm, đỡ, né | Animation đấm, đỡ, trúng đòn | Đối thủ AI đánh qua event |
| **2:00–2:20** | 🔗 **GHÉP LẦN 1 (bắt buộc):** webcam, robot, đối thủ và KO chạy cùng nhau | | | |
| **2:20–3:15** | Màn hình hiệp/KO, sửa bug | Chỉnh ngưỡng, phân biệt hook | Hiệu ứng, âm thanh | Mức khó, LLM bình luận |
| **3:15** | 🧊 **ĐÓNG BĂNG TÍNH NĂNG**, từ đây chỉ sửa bug | | | |
| **3:15–3:45** | Deploy và test trên máy demo | Test với nhiều người | Đánh bóng hình ảnh | Chốt slide, quay video dự phòng |
| **3:45–4:00** | 🎤 Tập demo 2 lần | | | |

**Nếu chậm tiến độ lúc 2:00:** bỏ hook, chỉ giữ jab, đỡ và né. Bỏ LLM. Ưu tiên ghép cho chạy được.

---

## 8. Ghi chú kỹ thuật cho từng phần

### 8.1 Vision (Chiến)

**Khởi tạo PoseLandmarker:**
```js
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const fileset = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
);
const pose = await PoseLandmarker.createFromOptions(fileset, {
  baseOptions: {
    modelAssetPath:
      'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    delegate: 'GPU',
  },
  runningMode: 'VIDEO',
  numPoses: 1,
});

function loop() {
  const res = pose.detectForVideo(video, performance.now());
  if (res.landmarks[0]) detectActions(res.landmarks[0]);
  requestAnimationFrame(loop);
}
```

**Các điểm landmark cần dùng:** `0` mũi · `11/12` vai trái/phải · `13/14` khuỷu · `15/16` cổ tay.
⚠️ "Trái" trong MediaPipe là tay trái *của người chơi*. Nếu lật video kiểu gương thì nhớ đổi lại cho khớp với robot.

**Luật nhận diện (gợi ý ban đầu, phải chỉnh lại bằng thử nghiệm):**
```js
// Đấm: tay duỗi gần thẳng và cổ tay di chuyển nhanh
const reach = dist(shoulder, wrist) / armLength;          // armLength đo lúc hiệu chỉnh
const speed = dist(wrist, prevWrist) / dt;
if (reach > 0.85 && speed > SPEED_TH && now - lastPunch[hand] > 300) {
  const kind = Math.abs(wrist.x - prevWrist.x) > Math.abs(wrist.y - prevWrist.y) * 1.5 ? 'hook' : 'jab';
  emit('PUNCH', { who: 'p1', hand, kind, power: Math.min(speed / MAX_SPEED, 1) });
}
// Đỡ: cả hai cổ tay ở gần mặt
const guard = dist(lWrist, nose) < 0.15 && dist(rWrist, nose) < 0.15;
// Né: mũi lệch khỏi điểm giữa hai vai
const offset = nose.x - (lShoulder.x + rShoulder.x) / 2;   // > 0.08 hoặc < -0.08 là né
```
- Làm mượt mọi toạ độ bằng EMA: `s = s * 0.6 + raw * 0.4`.
- Chỉ `emit` `GUARD` và `DODGE` **khi trạng thái thay đổi**, không phát lại mỗi frame.

### 8.2 Render (Thành)
- Robot là một `THREE.Group`, mỗi cánh tay là group con (vai, khuỷu, găng) để xoay theo khớp.
- **Jab:** đẩy găng tới trước 0.6 đơn vị trong 120ms rồi rút về trong 150ms.
- **Hook:** xoay vai quanh trục Y khoảng 70°.
- **Trúng đòn:** nghiêng thân ra sau 15°.
- **KO:** robot ngã ngửa và tắt đèn mắt.
- Tween đơn giản: lưu `{target, from, to, t0, dur}` và lerp trong vòng render, không cần thư viện.
- Màn hình gọn hơn: camera đặt sau vai p1, nhìn về phía p2.

### 8.3 Game logic (Duy)
```js
// Khi nhận PUNCH, chờ 250ms rồi mới tính trúng đòn để đối phương kịp phản ứng
on('PUNCH', ({ who, hand, kind, power }) => {
  emit('ANIM', { who, name: `${kind}_${hand}` });
  setTimeout(() => {
    const t = other(who);
    if (state[t].dodge && dodgeAvoids(state[t].dodge, hand)) return;
    const base = kind === 'hook' ? 10 : 5;
    const dmg  = base * (0.5 + power * 0.5) * (state[t].guard ? 0.2 : 1);
    hp[t] = Math.max(0, hp[t] - dmg);
    emit('HIT', { target: t, damage: dmg, blocked: state[t].guard });
    emit('HP', hp);
    if (hp[t] === 0) emit('ROUND', { state: 'ko', winner: who });
  }, 250);
});
```

### 8.4 Đối thủ AI (Tiến Anh)
```js
// Mỗi 100ms gọi tick một lần
const DIFF = { easy: { react: 0.2, aggro: 0.3 }, normal: { react: 0.45, aggro: 0.5 }, hard: { react: 0.7, aggro: 0.7 } };
function tick(p1State) {
  if (p1State.justPunched && Math.random() < cfg.react)
    return Math.random() < 0.5 ? emit('GUARD', { who: 'p2', on: true })
                               : emit('DODGE', { who: 'p2', dir: rand(['L', 'R']) });
  if (cooldownReady() && Math.random() < cfg.aggro) {
    const kind = p1State.guardingLong ? 'hook' : 'jab';
    emit('PUNCH', { who: 'p2', hand: rand(['L', 'R']), kind, power: 0.5 + Math.random() * 0.5 });
  }
}
```

**LLM bình luận (tuỳ chọn):** `server/index.js` mở `POST /commentary`, nhận số liệu của hiệp và trả về 1–2 câu bình luận tiếng Việt, giọng hào hứng. Gọi **một lần giữa mỗi hiệp**, không gọi theo thời gian thực. Nếu API lỗi thì hiện câu soạn sẵn.

---

## 9. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Webcam nhận nhầm, phòng thiếu sáng | Hiệu chỉnh ban đầu, EMA, khoảng chờ 300ms. Đứng cách cam khoảng 1.5–2m, thấy được nửa người trên |
| Webcam hoặc vision hỏng lúc demo | **Bàn phím luôn hoạt động song song**, có video dự phòng |
| Thành mất quá nhiều thời gian cho đồ hoạ | Chỉ dùng hình khối. 2:00 chưa xong thì giữ nguyên hình hiện tại |
| Ghép code vỡ phút chót | Format sự kiện cố định, ghép sớm lúc 2:00, đóng băng tính năng lúc 3:15 |
| API LLM chậm hoặc lỗi | Có câu bình luận soạn sẵn, LLM chỉ là phần cộng thêm |
| Lộ API key | Key chỉ nằm trong `server/.env`, không bao giờ đưa xuống frontend |

---

## 10. Checklist demo

- [ ] Máy demo đã cấp quyền webcam cho trình duyệt, có đủ ánh sáng
- [ ] Có link deploy và bản chạy local, cả hai đều đã thử
- [ ] Bàn phím dự phòng hoạt động
- [ ] Video dự phòng (1–2 phút) mở sẵn trong một tab
- [ ] Kịch bản 3 phút: **Vấn đề → Demo trực tiếp (người thật đấm và KO đối thủ) → Kiến trúc (Vision → Event → Game → Render, AI) → Hướng phát triển**
- [ ] Một người đấm, một người thuyết minh, một người cầm máy dự phòng

---

## 11. Repo tham khảo

> Các repo dưới đây lấy từ kết quả tìm kiếm web và chưa được kiểm tra kỹ. Mở ra xem trước khi dùng.

| Repo | Dùng để làm gì |
|---|---|
| [google-ai-edge/mediapipe-samples](https://github.com/google-ai-edge/mediapipe-samples) | ⭐ Điểm xuất phát cho vision: sample Pose Landmarker chính thức (web và Python) |
| [IvanGael/BoxingWithML](https://github.com/IvanGael/BoxingWithML) | Logic đếm cú đấm bằng MediaPipe và OpenCV, có độ trễ chống đếm trùng |
| [ra101/Pose2Input-MK9](https://github.com/ra101/Pose2Input-MK9) | Chuyển tư thế thành phím bấm để chơi Mortal Kombat, đúng kiểu ánh xạ nhóm cần |
| [suuuumcaa/cvgaming](https://github.com/suuuumcaa/cvgaming) | Game đấm bốc "Punch a Bunch": các tư thế đứng, đỡ, hook trái/phải |
| [OpenGenerativeAI/llm-colosseum](https://github.com/OpenGenerativeAI/llm-colosseum) | LLM chơi Street Fighter III: tham khảo prompt và cách trả hành động dạng JSON |
| [yeemachine/kalidokit](https://github.com/yeemachine/kalidokit) | Chuyển pose thành góc xoay khớp cho avatar 3D (đã ngừng phát triển, dùng để tham khảo) |
| [MuneebAnsari/ROUND-12](https://github.com/MuneebAnsari/ROUND-12) | App huấn luyện đấm bốc bằng pose estimation |
| [Kinemo (Devpost)](https://devpost.com/software/kinemo) · [Fight Cove (Devpost)](https://devpost.com/software/fight-cove) | Hai dự án hackathon tương tự (game đấm bốc điều khiển bằng webcam), tham khảo cách pitch |

**Tài liệu chính thức:**
- MediaPipe Pose Landmarker (Web): https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Three.js docs: https://threejs.org/docs/
- Claude API: https://docs.anthropic.com/

---

*Chúc cả team KO hackathon! 🥊🤖*
