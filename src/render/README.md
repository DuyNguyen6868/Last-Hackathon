# src/render: phần 3D (Thành)

Robot kiểu Real Steel trong đấu trường neon. Module chỉ **lắng nghe** event, không phát event nào.

## Dùng trong `main.js` (Duy)

```js
import { on, emit } from './events.js';
import { initRender } from './render/index.js';

const render = initRender({ bus: { on, emit } });          // canvas phủ kín document.body
// initRender({ container: el, bus, bloom: false })        // tắt bloom nếu máy yếu
```

`initRender` trả về `{ scene, camera, robots, renderer, dispose }`.

## Event nó nghe (theo HUONG_DAN.md mục 5)

| Event | Việc render làm |
|---|---|
| `ANIM { who, name }` | `jab_L/R`, `hook_L/R`, `dodge_L/R`, `hit`, `guard`, `idle`, `ko` |
| `HIT { target, damage, blocked }` | Tia lửa, vòng xung kích, rung camera, nháy đèn, âm thanh |
| `ROUND { state }` | `start`: reset robot + chuông · `end`/`ko`: chuông |

Lưu ý cho Game (Duy):
- **`HIT` chỉ làm hiệu ứng.** Robot chỉ lảo đảo khi game phát thêm `ANIM { name: 'hit' }`.
- `GUARD on` -> phát `ANIM guard`; `GUARD off` -> `ANIM idle`. Robot nhớ tư thế nền (idle/guard) và quay về đó sau mỗi đòn.
- `dir: 'L' | 'R'` của dodge tính theo **bên của robot** (L = bên trái robot).
- Sau `ANIM ko`, robot nằm im cho tới `ROUND { state: 'start' }`.

## Chạy demo độc lập (không cần game thật)

Khi dự án đã có Vite: `npm run dev` rồi mở `http://localhost:5173/src/render/demo.html`.
Phím: `J/K` jab · `U/I` hook · giữ `L` đỡ · `A/D` né · `1/2/3` trúng đòn · `O/P` KO · `R` hiệp mới · `T` AI giả.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.js` | Khởi tạo, nối event, vòng lặp, camera, slow-mo khi KO |
| `scene.js` | Đấu trường, đèn, camera |
| `robot.js` | `createRobot(id)`: dựng robot từ hình khối, các kênh khớp |
| `poses.js` | Các kênh khớp và tư thế nền (idle/guard) |
| `anim.js` | Animation đòn đánh, né, trúng đòn, KO |
| `tween.js` | Tween keyframe tự viết |
| `effects.js` | Tia lửa, vòng xung kích, rung camera |
| `audio.js` | Âm thanh tổng hợp bằng WebAudio (không cần file) |

Chỉnh nhanh: tư thế/đòn đánh trong `poses.js` và `anim.js`; màu robot trong `PALETTES` (`robot.js`); độ sáng đèn trong `scene.js`.

## Robot dùng model .glb (Atom, Zeus)

Đặt `public/models/atom.glb` (p1) và `public/models/zeus.glb` (p2). Có file thì `robot-glb.js` tự thay robot
hình khối, không có hoặc tải lỗi thì giữ robot hình khối (xem log `[render] ...` trong console).

Yêu cầu model: có xương (Mixamo/Unreal/Blender đều được), đứng T-pose hoặc A-pose, nhìn về +z, dưới ~5MB và ~30k tam giác.
Loader tự dò xương theo tên (`LeftArm`, `LeftForeArm`, `LeftHand`, `Head`...) và tự tính hướng xoay từng khớp,
nên không cần chỉnh dấu/trục theo từng model.

Chỉnh cho từng model trong `GLB_MODELS` (`robot-glb.js`): `height`, `yaw` (nếu model nhìn ngược), `bones` (ghi đè tên xương).
Debug trong console: `robots.p1.missing` (khớp không dò ra xương), `robots.p1.bones` (xương đã dò).
Model không có xương: chỉ có chuyển động cả thân (lao tới, né, ngã), tay không cử động.
Tắt thử tải: `initRender({ bus, glb: false })`.
