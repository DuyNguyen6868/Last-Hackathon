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
| LLM (tuỳ chọn) | Claude API qua proxy Express nhỏ trong `server/`. Mặc định `claude-opus-5-5` ở effort `low`, có thể đổi sang `claude-haiku-5-5` trong `.env` để nhanh và rẻ hơn |
| Deploy | Vercel hoặc GitHub Pages (chỉ frontend) |

> **Phương án dự phòng** nếu JS gặp khó: Python 3.12 với `opencv-python`, `mediapipe` và `pygame` làm game 2D. Chỉ chuyển trong 30 phút đầu, sau đó không đổi nữa.

---

## 3. Cài đặt và chạy

Yêu cầu: Node 20 trở lên, Chrome hoặc Edge, máy có webcam.

> ✅ **Khung dự án đã có sẵn và chạy được:** game hoàn chỉnh ở mức MVP (bàn phím, webcam, đối thủ AI, máu, hiệp, KO, hiệu ứng, âm thanh, bình luận). Mỗi người clone về là làm tiếp phần của mình, không cần dựng lại.

**Mọi người:**
```bash
git clone <repo-url> && cd Last-Hackathon
npm install
npm run dev        # mở http://localhost:5173
```
- Mở `http://localhost:5173/?autostart` để vào trận ngay, không qua menu.
- Bấm **"Bật webcam"** ở menu để dùng MediaPipe. Góc phải dưới hiện khung xương và các chỉ số debug (`ext`, `v`, `hook`, `guard`, `dodge`) để chỉnh ngưỡng.
- Trong console trình duyệt: `DEBUG_EVENTS = true` để log mọi event, `game.f.p2.hp = 1` để test KO.

**Server bình luận LLM (Tiến Anh, tuỳ chọn):**
```bash
cp .env.example .env     # điền ANTHROPIC_API_KEY, KHÔNG commit file .env
npm run server           # chạy ở cổng 8787. Vite đã proxy /api sang cổng này
```
Không chạy server thì game vẫn hiện câu bình luận soạn sẵn.

**Kiểm tra trước khi push:** `npm run build` phải chạy qua không lỗi.

---

## 4. Cấu trúc thư mục và quy tắc Git

```
index.html             # Duy: khung HTML (HUD, menu, ô webcam)
src/
  main.js              # Duy: khởi tạo, nối module, vòng lặp chính
  events.js            # Duy: event bus (on/emit)
  config.js            # CHUNG: mọi con số cân bằng game và ngưỡng vision
  style.css            # Duy: giao diện HUD và menu
  input/keyboard.js    # Duy: điều khiển bằng bàn phím
  game/game.js         # Duy: máu, hiệp, luật trúng đòn, KO
  game/hud.js          # Duy: thanh máu, đồng hồ, banner, bình luận
  vision/pose.js       # Chiến: webcam, PoseLandmarker, vẽ khung xương
  vision/detector.js   # Chiến: luật nhận diện đấm, đỡ, né
  render/scene.js      # Thành: đấu trường, camera, tia lửa, rung màn hình
  render/robot.js      # Thành: robot hình khối, IK cánh tay, animation
  render/sfx.js        # Thành: âm thanh tổng hợp bằng WebAudio
  ai/opponent.js       # Tiến Anh: FSM cho ZEUS, 3 mức khó
  ai/commentary.js     # Tiến Anh: gọi /api/commentary, có câu dự phòng
server/index.js        # Tiến Anh: proxy Claude API
REPOS.md               # Tổng hợp repo tham khảo
```
`config.js` là file chung. Ai sửa số nào thì nhắn nhóm để khỏi conflict.

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
| `ANIM` | `{ who, name: 'jab_L'\|'jab_R'\|'hook_L'\|'hook_R'\|'guard'\|'dodge_L'\|'dodge_R'\|'hit'\|'ko'\|'idle'\|'reset' }` | Chạy animation (`reset` khi bắt đầu hiệp mới) |
| `HIT` | `{ attacker, target, damage, blocked: bool, kind }` | Trúng đòn, dùng cho hiệu ứng và âm thanh |
| `MISS` | `{ attacker, target }` | Đòn bị né |
| `HP` | `{ p1: 0..100, p2: 0..100 }` | Cập nhật thanh máu |
| `TIMER` | `{ seconds }` | Đồng hồ hiệp |
| `ROUND` | `{ round, state: 'countdown'\|'fight'\|'end'\|'ko'\|'over', winner?, stats?, wins }` | Trạng thái hiệp và trận |
| `COMMENTARY` | `{ text }` | Câu bình luận hiện trên màn hình |

**Phím mặc định (p1):** `J` jab trái · `K` jab phải · `U` hook trái · `I` hook phải · `L` giữ để đỡ · `A`/`D` né.

---

## 6. Phân công

> Các mục **(đã có khung)** đã chạy được trong code hiện tại. Việc của người phụ trách là **chỉnh cho tốt hơn và test**, không phải viết lại từ đầu.

### 👑 Duy: trưởng nhóm, ghép code và logic game
- [x] Khung dự án, `events.js`, `keyboard.js`, `main.js` **(đã có khung)**
- [x] Game state: máu, 3 hiệp × 60 giây, KO, thắng theo số hiệp **(đã có khung)**
- [x] Luật trúng đòn: đòn mất 250ms mới chạm, đỡ thì sát thương ×0.2, né trong 650ms đầu thì trượt, bị trúng thì choáng 220ms **(đã có khung)**
- [x] HUD: thanh máu, đồng hồ, cúp thắng hiệp, banner ROUND / FIGHT! / K.O. **(đã có khung)**
- [ ] Chơi thử nhiều lần và cân bằng các số trong `config.js` (sát thương, thời gian hiệp)
- [ ] *(Nếu kịp)* combo jab-jab-hook gây thêm sát thương, chế độ 2 người chơi (p2 dùng phím mũi tên)
- [ ] Review và merge, chủ trì ghép code, deploy lên Vercel hoặc GitHub Pages

### 👁️ Chiến: vision
- [x] Webcam, PoseLandmarker chế độ `VIDEO`, overlay khung xương, chỉ số debug **(đã có khung)**
- [x] Luật đấm (độ duỗi tay + tốc độ cổ tay), hook (khuỷu cao + quét ngang), đỡ, né, làm mượt EMA **(đã có khung)**
- [ ] **Việc quan trọng nhất:** đứng trước cam, xem các chỉ số debug, chỉnh ngưỡng `CONFIG.vision` với **cả 4 người** ở nhiều mức ánh sáng
- [ ] Kiểm tra chiều trái/phải: tay trái người chơi phải khớp với tay robot hiện bên trái màn hình
- [ ] *(Nếu kịp)* nút "Hiệu chỉnh lại" gọi `detector.recalibrate()`, cảnh báo khi người chơi đứng quá gần hoặc quá xa

### 🤖 Thành: 3D và hiệu ứng
- [x] Đấu trường, 4 cột, 3 tầng dây, đèn spotlight và đèn viền xanh/đỏ **(đã có khung)**
- [x] Robot hình khối, tay 2 đoạn giải bằng IK, animation jab, hook, đỡ, né, trúng đòn, KO **(đã có khung)**
- [x] Tia lửa, rung camera, robot nháy đỏ khi trúng, âm thanh tổng hợp bằng WebAudio **(đã có khung)**
- [ ] Chỉnh góc camera (`camBase`, `lookAt` trong `scene.js`) để thấy rõ cả hai robot
- [ ] Làm robot ngầu hơn: thêm chi tiết như ống xả, đèn ngực, vai giáp. Hiện số sát thương bay lên khi trúng đòn
- [ ] *(Nếu kịp)* thay âm thanh tổng hợp bằng file thật, thêm tiếng khán giả

### 🧠 Tiến Anh: đối thủ AI, LLM và pitch
- [x] FSM cho ZEUS: phản ứng khi p1 vừa đấm (đỡ hoặc né), dùng hook khi p1 đỡ lâu, combo, thủ nhiều hơn khi máu thấp, 3 mức khó **(đã có khung)**
- [x] `server/index.js` gọi Claude để bình luận sau mỗi hiệp, `ai/commentary.js` có câu dự phòng **(đã có khung)**
- [ ] Lấy API key, chạy `npm run server`, thử và chỉnh prompt bình luận cho hay hơn
- [ ] Cân bằng `DIFFICULTY` trong `opponent.js` để Easy dễ thắng, Hard khó thật
- [ ] *(Nếu kịp)* LLM làm huấn luyện viên cho ZEUS: giữa hiệp trả về JSON chiến thuật như `{"aggro":0.7,"favor":"hook"}` (xem llm-colosseum trong [REPOS.md](REPOS.md))
- [ ] Slide pitch (5–6 slide), kịch bản demo, **quay video dự phòng** lúc 3:30

---

## 7. Timeline

T = giờ bắt đầu. Đặt báo thức cho từng mốc.

| Mốc | Duy | Chiến | Thành | Tiến Anh |
|---|---|---|---|---|
| **0:00–0:20** | Cả nhóm clone, `npm install`, `npm run dev`, mỗi người chơi thử 1 trận bằng bàn phím và 1 trận bằng webcam | | | |
| **0:20–1:00** | Cân bằng `config.js`, ghi lại bug | Chỉnh ngưỡng vision với chính mình | Chỉnh camera, làm robot đẹp hơn | Chạy server LLM, chỉnh prompt |
| **1:00–2:00** | Combo hoặc 2 người chơi, deploy thử | Chỉnh ngưỡng với cả 4 người, sửa trái/phải | Số sát thương, chi tiết robot | Cân bằng độ khó, viết slide |
| **2:00–2:20** | 🔗 **GHÉP LẦN 1 (bắt buộc):** merge tất cả nhánh, chơi thử trọn trận bằng webcam | | | |
| **2:20–3:15** | Sửa bug sau ghép | Ổn định nhận diện hook | Âm thanh, hiệu ứng | LLM huấn luyện viên (nếu kịp) |
| **3:15** | 🧊 **ĐÓNG BĂNG TÍNH NĂNG**, từ đây chỉ sửa bug | | | |
| **3:15–3:45** | Deploy và test trên máy demo | Test với nhiều người | Đánh bóng hình ảnh | Chốt slide, quay video dự phòng |
| **3:45–4:00** | 🎤 Tập demo 2 lần | | | |

**Nếu chậm tiến độ lúc 2:00:** bỏ hook, chỉ giữ jab, đỡ và né. Bỏ LLM. Ưu tiên ghép cho chạy được.

---

## 8. Ghi chú kỹ thuật cho từng phần

> Các đoạn code dưới đây là **bản rút gọn để hiểu ý tưởng**. Code thật, đầy đủ và đã chạy nằm trong: `src/vision/detector.js`, `src/render/robot.js`, `src/game/game.js`, `src/ai/opponent.js`. Ngưỡng thật nằm trong `src/config.js`. Ví dụ, detector thật dùng **world landmarks** (đơn vị mét) để nhận đấm, khác với bản rút gọn.

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

> 👉 **Bản tổng hợp chi tiết** (số sao, license, cách hoạt động, áp dụng gì cho nhóm) nằm ở [REPOS.md](REPOS.md). Bảng dưới chỉ là tóm tắt.

| Repo | Dùng để làm gì |
|---|---|
| [google-ai-edge/mediapipe-samples](https://github.com/google-ai-edge/mediapipe-samples) | ⭐ Điểm xuất phát cho vision: sample Pose Landmarker chính thức (web và Python) |
| [iv4n-ga6l/BoxingWithML](https://github.com/iv4n-ga6l/BoxingWithML) | Logic đếm cú đấm bằng MediaPipe và OpenCV, có độ trễ chống đếm trùng |
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
