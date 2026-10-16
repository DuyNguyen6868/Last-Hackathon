# 📚 Tổng hợp repo tham khảo: Reel Steel

Tổng hợp ngày 16/10/2026 từ kết quả tìm kiếm web và nội dung từng trang GitHub. Số sao lấy tại thời điểm đọc.

**Kết luận nhanh:** Không có repo nào làm sẵn đúng ý tưởng "robot đấm bốc điều khiển bằng webcam". Khung dự án của nhóm tự ghép từ các mảnh: **MediaPipe (vision) + luật hình học kiểu Pose2Input (nhận diện đòn) + Three.js (3D) + FSM (đối thủ) + prompt kiểu llm-colosseum (LLM)**.

---

## ⭐ Nên đọc trước

### 1. google-ai-edge/mediapipe-samples
- **Link:** https://github.com/google-ai-edge/mediapipe-samples
- **Thông tin:** ⭐ 2.9k · Apache-2.0 · sample chính thức của Google
- **Đường dẫn cần xem:** `examples/pose_landmarker/js` (web) và `examples/pose_landmarker/python`. Có thêm bản Android, iOS, Raspberry Pi
- **Dùng cho:** Chiến tham khảo cách khởi tạo `PoseLandmarker`, chạy chế độ `VIDEO` và vẽ khung xương. Code của nhóm trong `src/vision/pose.js` đi theo đúng mẫu này

### 2. ra101/Pose2Input-MK9
- **Link:** https://github.com/ra101/Pose2Input-MK9
- **Thông tin:** ⭐ 13 · MIT · Python (OpenCV, MediaPipe, PyAutoGUI)
- **Ý tưởng:** Chơi Mortal Kombat 9 bằng cơ thể. Pose được đổi thành phím bấm. Cách này giống hệt kiến trúc "Vision → Event" của nhóm
- **Cách làm (4 bước):** OpenCV bắt frame khi có chuyển động → MediaPipe trả landmark → luật hình học phân loại tư thế → PyAutoGUI gửi phím
- **Luật đáng học** (file `run.py`, `translate.py`):

  | Đòn | Luật |
  |---|---|
  | Punch | Độ dốc vai→cổ tay trong khoảng ±10.5° và góc khuỷu 169.5°–190.5° (tay duỗi gần thẳng, song song mặt đất) |
  | Block | Cổ tay cao hơn mũi, cả hai cao hơn khuỷu cùng bên |
  | Throw | Cổ tay cao hơn khuỷu, cả hai cao hơn mũi |
  | Kick | Độ dốc cổ chân→hông trong khoảng 45°–135° |
  | Down | Tỉ lệ khoảng cách hông→mũi so với hông→gối lớn hơn 7:10 |

- **Áp dụng:** Luật đỡ (cổ tay gần mặt) và điều kiện tay duỗi gần thẳng trong `src/vision/detector.js` lấy cảm hứng từ đây. Khác biệt: nhóm thêm điều kiện **tốc độ cổ tay** để tránh nhận nhầm khi người chơi chỉ đưa tay ra

### 3. OpenGenerativeAI/llm-colosseum
- **Link:** https://github.com/OpenGenerativeAI/llm-colosseum
- **Thông tin:** ⭐ ~1.5k · MIT · Python. Ra đời tại hackathon của Mistral
- **Ý tưởng:** Cho các LLM đánh nhau trong Street Fighter III rồi xếp hạng Elo
- **Cách LLM nhận trạng thái game:**
  - `TextRobot`: nhận mô tả bằng chữ (vị trí, máu, năng lượng, đòn trước đó của mình và đối thủ)
  - `VisionRobot`: nhận ảnh chụp màn hình
- **Prompt:** System prompt bảo model đóng vai người chơi hiếu chiến, kèm danh sách đòn được phép. Model trả về danh sách gạch đầu dòng `- <tên đòn>`, `max_tokens=50`. Code nằm trong `agent/robot.py`, hàm `call_llm()`
- **Áp dụng:** Nếu còn thời gian, Tiến Anh có thể cho LLM làm "huấn luyện viên" chọn chiến thuật cho ZEUS giữa các hiệp, trả về JSON như `{"aggro":0.7,"favor":"hook"}`. Bản hiện tại trong `server/index.js` chỉ làm bình luận viên

---

## Tham khảo thêm

### 4. yeemachine/kalidokit
- **Link:** https://github.com/yeemachine/kalidokit · demo VRM: https://github.com/yeemachine/kalidokit/tree/main/docs
- **Thông tin:** ⭐ 5.7k · MIT · ⚠️ **đã ngừng phát triển** (README ghi rằng tính năng sẽ được đưa vào MediaPipe)
- **Dùng cho:** Chuyển 33 pose landmark thành góc xoay khớp (`Kalidokit.Pose.solve(world3D, landmarks2D, {runtime:'mediapipe', video})`, trả về `RightUpperArm`, `LeftLowerArm`, `Spine`, `Hips`...)
- **Khi nào cần:** Chỉ khi muốn robot **bắt chước toàn thân** người chơi thay vì chạy animation dựng sẵn. Không nên dùng trong 4 tiếng

### 5. iv4n-ga6l/BoxingWithML (tên cũ IvanGael/BoxingWithML)
- **Link:** https://github.com/iv4n-ga6l/BoxingWithML
- **Thông tin:** ⭐ 6 · Python (`app.py`, MediaPipe Hands, OpenCV) · không ghi license
- **Ý tưởng:** Phát hiện nắm tay trong video, phân biệt trái/phải, đếm cú đấm, có **độ trễ chống đếm trùng**
- **Áp dụng:** Ý tưởng khoảng chờ giữa hai cú đấm (`punchCooldownMs`) và cờ "phải co tay mới đấm tiếp" (`armed`) trong detector. Repo dùng Hands chứ không phải Pose, nên không lấy code trực tiếp

### 6. suuuumcaa/cvgaming (fork của alexsmirnov6/cvgaming)
- **Link:** https://github.com/suuuumcaa/cvgaming
- **Thông tin:** ⭐ 0 · Python · có file LICENSE nhưng trang không ghi loại
- **Ý tưởng:** Chơi game bằng webcam. Game đấm bốc "Punch a Bunch" có 4 tư thế: đứng, đỡ, hook trái, hook phải
- **Cách làm:** **Train model** (Gradient Boosting, Random Forest) trên dữ liệu pose tự thu khoảng 1 phút mỗi tư thế, lưu CSV, model `.pkl`. Xem `PaB_inference.py`
- **Áp dụng:** Phương án dự phòng nếu luật hình học nhận diện kém: thu dữ liệu 4 tư thế rồi train một classifier nhỏ. Tốn khoảng 45 phút, chỉ làm nếu thật cần

### 7. MuneebAnsari/ROUND-12
- **Link:** https://github.com/MuneebAnsari/ROUND-12
- **Thông tin:** ⭐ 2 · Apache-2.0 · Python + Flask, dùng tf-pose-estimation (không phải MediaPipe)
- **Ý tưởng:** "Huấn luyện viên đấm bốc cá nhân": chấm tư thế, độ duỗi cú jab, tay đỡ, rồi đưa nhận xét bằng chữ
- **Áp dụng:** Ý tưởng cho phần pitch hoặc hướng phát triển ("chế độ luyện tập: AI chấm kỹ thuật jab của bạn"). Các file `jab_feedback.py` và `guard_hand_feedback.py` có luật theo góc khớp

---

## Dự án hackathon tương tự (chỉ tham khảo ý tưởng và cách pitch)

| Dự án | Tóm tắt | Ghi chú |
|---|---|---|
| **Beach Box / Fight Cove**: https://devpost.com/software/fight-cove | Game đánh nhau 2 người trên trình duyệt, MediaPipe Tasks Vision điều khiển nhân vật 3D, Next.js + React Three Fiber, Supabase Realtime để chơi online, Gemini để tìm lại clip trận đấu | Không tìm thấy repo công khai. Nhóm này cho biết khó nhất là **khớp rig 3D với cánh tay** và **nhận diện cú đấm ổn định** |
| **Kinemo**: https://devpost.com/software/kinemo | Game đấm bốc bằng webcam (Python, OpenCV, MediaPipe, Pygame): đấm, đá, né, mỗi đòn chờ 0.5 giây | ⚠️ Trang Devpost chặn truy cập tự động (HTTP 403) nên chưa đọc được chi tiết hay tìm được link repo. Mở bằng trình duyệt để xem |

---

## Tài liệu chính thức
- MediaPipe Pose Landmarker (Web): https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Three.js docs: https://threejs.org/docs/
- Claude API: https://docs.anthropic.com/
