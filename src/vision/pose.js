// Webcam + MediaPipe PoseLandmarker (Chiến).
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { emit } from '../events.js';
import { ActionDetector } from './detector.js';

// Phiên bản WASM phải khớp với @mediapipe/tasks-vision trong package.json
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export async function startVision({ video, canvas, debugEl, onStatus = () => {} }) {
  onStatus('Đang xin quyền webcam...');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  onStatus('Đang tải model pose...');
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  const draw = new DrawingUtils(ctx);
  const detector = new ActionDetector(emit, 'p1');
  let lastVideoTime = -1;

  function loop() {
    const now = performance.now();
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const res = landmarker.detectForVideo(video, now);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = res.landmarks[0];
      if (image) {
        detector.update(image, res.worldLandmarks[0], now);
        draw.drawConnectors(image, PoseLandmarker.POSE_CONNECTIONS, { color: '#66e0ff', lineWidth: 3 });
        draw.drawLandmarks(image, { color: '#ffd23f', radius: 3 });
      }
      if (debugEl) {
        const d = detector.debug;
        debugEl.textContent = image
          ? `L ext ${d.L?.ext} v ${d.L?.speed} hook ${d.L?.hook}\nR ext ${d.R?.ext} v ${d.R?.speed} hook ${d.R?.hook}\nguard ${d.guard}  dodge ${d.dodge}`
          : 'Không thấy người: lùi ra để thấy nửa người trên';
      }
    }
    requestAnimationFrame(loop);
  }
  loop();

  onStatus('Webcam đã bật. Đứng cách camera 1.5–2m, thấy rõ nửa người trên.');
  return { detector, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}
