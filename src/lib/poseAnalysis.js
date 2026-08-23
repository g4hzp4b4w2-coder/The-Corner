let visionPromise = null;

// The WASM runtime + model files are fetched once and cached by the browser;
// this just avoids kicking off that fetch more than once per page load.
function getVision() {
  if (!visionPromise) {
    visionPromise = (async () => {
      const { FilesetResolver } = await import("@mediapipe/tasks-vision");
      return FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
    })().catch((e) => {
      visionPromise = null; // let a later attempt retry instead of staying broken forever
      throw e;
    });
  }
  return visionPromise;
}

// A pose session wraps one PoseLandmarker instance running in MediaPipe's
// "VIDEO" mode, which — unlike treating every frame as an isolated image —
// tracks temporal continuity between calls (smoother, more stable joint
// positions across a sequence than detecting each frame cold). VIDEO mode
// requires strictly increasing timestamps across calls to the same
// instance; we don't need these to match the actual video time, just to
// keep increasing, so each session tracks its own synthetic counter.
export async function createPoseSession() {
  const { PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await getVision();
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  let ts = 0;

  return {
    // Returns the 33-point landmark array for this frame, or null if no
    // pose was found or detection failed — never throws.
    detect(imageSource) {
      ts += 33;
      try {
        const result = landmarker.detectForVideo(imageSource, ts);
        return result?.landmarks?.[0] || null;
      } catch (e) {
        return null;
      }
    },
    close() {
      try {
        landmarker.close();
      } catch (e) {
        // already gone, nothing to do
      }
    },
  };
}

// Sum of per-joint displacement between two landmark sets (normalized 0-1
// coordinates), used to score how much real body motion happened between
// two frames — a much more direct signal than comparing raw pixels, which
// can be thrown off by lighting, camera shake, or background movement.
export function poseMotionScore(a, b) {
  if (!a || !b) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  }
  return sum;
}

// Pairs of landmark indices to connect when drawing the skeleton.
// Indices follow MediaPipe's 33-point pose model.
const CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export function drawSkeleton(canvas, landmarks) {
  if (!landmarks) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#22d3ee";
  ctx.fillStyle = "#22d3ee";

  CONNECTIONS.forEach(([a, b]) => {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) return;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  });

  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function trendWord(arr, lang) {
  const delta = arr[arr.length - 1] - arr[0];
  const threshold = 0.02; // ignore noise smaller than this (normalized 0-1 scale)
  if (Math.abs(delta) < threshold) return lang === "en" ? "stayed steady" : "sabit kaldı";
  if (lang === "en") return delta > 0 ? "rose" : "dropped";
  return delta > 0 ? "yükseldi" : "düştü";
}

// Builds a short, honest text summary from real tracked landmarks across the
// selected frames — meant to give the AI coach measured numbers to reason
// about instead of only guessing from still images. Returns "" if there
// isn't enough real pose data to say anything meaningful.
export function computePoseMetrics(landmarksSequence, lang) {
  const frames = landmarksSequence.filter(Boolean);
  if (frames.length < 2) return "";

  const guardLeft = frames.map((f) => f[11].y - f[15].y);
  const guardRight = frames.map((f) => f[12].y - f[16].y);
  const stanceWidth = frames.map((f) => Math.abs(f[27].x - f[28].x));

  if (lang === "en") {
    return `Real body-tracking data measured across ${frames.length} of the frames (pose detection, not a visual guess): left guard hand ${trendWord(
      guardLeft,
      lang
    )} over the clip, right guard hand ${trendWord(guardRight, lang)}, average stance width ${avg(stanceWidth).toFixed(
      2
    )} (fraction of frame width — larger means wider stance).`;
  }
  return `${frames.length} karede gerçek vücut takip verisiyle ölçüldü (görsel tahmin değil, poz tespiti): sol guard eli klip boyunca ${trendWord(
    guardLeft,
    lang
  )}, sağ guard eli ${trendWord(guardRight, lang)}, ortalama duruş genişliği ${avg(stanceWidth).toFixed(
    2
  )} (kare genişliğine oran — büyük değer daha geniş duruş demek).`;
}
