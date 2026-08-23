let landmarkerPromise = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    })().catch((e) => {
      landmarkerPromise = null; // allow retrying on the next frame instead of staying broken forever
      throw e;
    });
  }
  return landmarkerPromise;
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

// Runs pose detection on a canvas frame and draws the skeleton directly onto
// it. Returns the raw landmarks (for metric computation) or null if no pose
// was found or detection failed for any reason — callers should treat that as
// "no pose data this frame" and keep going, never as a fatal error.
export async function detectAndDrawPose(canvas) {
  try {
    const landmarker = await getLandmarker();
    const result = landmarker.detect(canvas);
    const landmarks = result?.landmarks?.[0];
    if (!landmarks) return null;

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

    return landmarks;
  } catch (e) {
    return null;
  }
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
