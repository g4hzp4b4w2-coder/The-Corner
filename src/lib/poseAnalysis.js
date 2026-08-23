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

const MIN_VISIBILITY = 0.5;

function isVisible(point) {
  // MediaPipe marks how confident it is that a landmark is actually visible
  // (not occluded / off-frame). Treat a missing field as visible rather than
  // fail closed, in case a future model version doesn't populate it.
  return !!point && (point.visibility === undefined || point.visibility >= MIN_VISIBILITY);
}

// A pose session wraps one PoseLandmarker instance running in MediaPipe's
// "VIDEO" mode, which — unlike treating every frame as an isolated image —
// tracks temporal continuity between calls (smoother, more stable joint
// positions across a sequence than detecting each frame cold). VIDEO mode
// requires strictly increasing timestamps across calls to the same
// instance; we don't need these to match the actual video time, just to
// keep increasing, so each session tracks its own synthetic counter.
//
// numPoses is 2 so two-person clips (sparring) get both people tracked
// instead of one skeleton flickering between whoever the model happens to
// pick up that frame.
export async function createPoseSession() {
  const { PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await getVision();
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 2,
  });

  let ts = 0;

  return {
    // Returns an array of landmark sets, one per person MediaPipe found in
    // this frame (0, 1, or 2). Never throws — returns [] on failure.
    detectAll(imageSource) {
      ts += 33;
      try {
        const result = landmarker.detectForVideo(imageSource, ts);
        return result?.landmarks || [];
      } catch (e) {
        return [];
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
// coordinates), ignoring points MediaPipe wasn't confident about — used to
// score how much real body motion happened between two frames, a much more
// direct signal than comparing raw pixels.
export function poseMotionScore(a, b) {
  if (!a || !b) return 0;
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < a.length; i++) {
    if (isVisible(a[i]) && isVisible(b[i])) {
      sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
      counted++;
    }
  }
  return counted > 0 ? sum : 0;
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

const PERSON_COLORS = ["#22d3ee", "#f59e0b"];

// Draws every detected person's skeleton onto the canvas, each in its own
// color, and skips any joint/connection MediaPipe wasn't confident about
// instead of drawing a misplaced point during fast, blurry motion.
export function drawSkeletons(canvas, peopleLandmarks) {
  if (!peopleLandmarks || peopleLandmarks.length === 0) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  peopleLandmarks.forEach((landmarks, personIndex) => {
    const color = PERSON_COLORS[personIndex % PERSON_COLORS.length];
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    CONNECTIONS.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!isVisible(pa) || !isVisible(pb)) return;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    });

    landmarks.forEach((p) => {
      if (!isVisible(p)) return;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function centroid(landmarks) {
  const pts = landmarks.filter(isVisible);
  if (pts.length === 0) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

// Simplest case: exactly one person expected per frame, just take whoever
// MediaPipe detected first.
export function resolveSinglePersonSequence(framesPeople) {
  return framesPeople.map((people) => (people && people[0]) || null);
}

// MediaPipe doesn't guarantee a person keeps the same array index between
// frames, so when there are two people (sparring) we need our own light
// tracking: starting from the frame where the user told us which one is
// them, follow that identity across the rest of the clip by matching each
// frame's closest body-centroid to the previous frame's — a simple,
// dependency-free way to turn independent per-frame detections into one
// consistent track.
export function linkPersonAcrossFrames(framesPeople, startIndex, startFrameIdx) {
  const linked = new Array(framesPeople.length).fill(null);
  let prevCentroid = null;

  for (let i = 0; i < framesPeople.length; i++) {
    const people = framesPeople[i] || [];
    if (people.length === 0) {
      continue;
    }

    let chosenIdx;
    if (i === startFrameIdx) {
      chosenIdx = Math.min(startIndex, people.length - 1);
    } else if (prevCentroid) {
      let best = 0;
      let bestDist = Infinity;
      people.forEach((landmarks, idx) => {
        const cen = centroid(landmarks);
        if (!cen) return;
        const d = Math.hypot(cen.x - prevCentroid.x, cen.y - prevCentroid.y);
        if (d < bestDist) {
          bestDist = d;
          best = idx;
        }
      });
      chosenIdx = best;
    } else {
      chosenIdx = 0;
    }

    linked[i] = people[chosenIdx] || null;
    const cen = linked[i] ? centroid(linked[i]) : null;
    if (cen) prevCentroid = cen;
  }

  return linked;
}

const REQUIRED_METRIC_POINTS = [11, 12, 15, 16, 27, 28];

// Builds a real numeric time-series table from tracked landmarks across the
// whole clip (not just the handful of frames sent as images) — meant to
// give the AI coach measured data covering the entire video's movement,
// not just a coarse one-line trend summary. Skips any sample where the
// needed points weren't tracked with enough confidence. Returns "" if
// there isn't enough reliable data to build a useful table.
export function buildPoseTable(samples, lang) {
  const rows = samples
    .filter((s) => s.landmarks && REQUIRED_METRIC_POINTS.every((i) => isVisible(s.landmarks[i])))
    .map((s) => ({
      t: s.t.toFixed(1),
      guardL: (s.landmarks[11].y - s.landmarks[15].y).toFixed(2),
      guardR: (s.landmarks[12].y - s.landmarks[16].y).toFixed(2),
      stance: Math.abs(s.landmarks[27].x - s.landmarks[28].x).toFixed(2),
    }));

  if (rows.length < 2) return "";

  const header =
    lang === "en"
      ? "Real body-tracking measurements sampled across the whole clip (pose detection, not a visual guess) — for each moment: time in seconds, left guard height, right guard height, stance width. All normalized 0-1; a larger guard value means the hand is held higher, a larger stance value means a wider stance:"
      : "Klibin tamamından örneklenmiş gerçek vücut takip ölçümleri (görsel tahmin değil, poz tespiti) — her an için: saniye, sol guard yüksekliği, sağ guard yüksekliği, duruş genişliği. Hepsi 0-1 arası normalize; büyük guard değeri eli daha yukarıda tutmak, büyük duruş değeri daha geniş duruş demek:";

  const lines = rows.map(
    (r) => `${r.t}s: ${lang === "en" ? "L-guard" : "sol-guard"}=${r.guardL}, ${lang === "en" ? "R-guard" : "sağ-guard"}=${r.guardR}, ${lang === "en" ? "stance" : "duruş"}=${r.stance}`
  );

  return `${header}\n${lines.join("\n")}`;
}

// Renders one composite image showing the tracked skeleton at each sample
// overlaid on the same frame, fading from faint (earliest) to solid
// (latest) — a single glance at how the movement flowed across the clip,
// instead of only separate stills. Returns null if there isn't enough
// data to draw.
export function drawMotionTrail(width, height, samples) {
  const valid = samples.filter((s) => s.landmarks);
  if (valid.length < 2) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  valid.forEach((s, i) => {
    ctx.globalAlpha = 0.22 + (0.78 * i) / (valid.length - 1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#22d3ee";
    ctx.fillStyle = "#22d3ee";
    CONNECTIONS.forEach(([a, b]) => {
      const pa = s.landmarks[a];
      const pb = s.landmarks[b];
      if (!isVisible(pa) || !isVisible(pb)) return;
      ctx.beginPath();
      ctx.moveTo(pa.x * width, pa.y * height);
      ctx.lineTo(pb.x * width, pb.y * height);
      ctx.stroke();
    });
  });
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}
