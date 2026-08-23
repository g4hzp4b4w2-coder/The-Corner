import { createPoseSession, poseMotionScore, drawSkeletons } from "./poseAnalysis";

function waitFor(target, event) {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      target.removeEventListener(event, onOk);
      target.removeEventListener("error", onErr);
      resolve();
    };
    const onErr = () => {
      target.removeEventListener(event, onOk);
      target.removeEventListener("error", onErr);
      reject(new Error(`Failed waiting for ${event}`));
    };
    target.addEventListener(event, onOk);
    target.addEventListener("error", onErr);
  });
}

function frameCountForDuration(duration) {
  if (duration <= 8) return 6;
  if (duration <= 15) return 9;
  if (duration <= 30) return 12;
  if (duration <= 60) return 16;
  return 18;
}

// Fallback motion signal for when real pose tracking isn't available —
// raw average pixel change between two frames.
function pixelMotionScore(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const ga = (a[i] + a[i + 1] + a[i + 2]) / 3;
    const gb = (b[i] + b[i + 1] + b[i + 2]) / 3;
    sum += Math.abs(ga - gb);
  }
  return sum;
}

// Returns { frames, framesPeople, frameTimestamps }. framesPeople is the raw,
// per-frame list of detected people (each an array of pose landmark sets —
// usually length 1, length 2 for a two-person clip like sparring). Metrics
// aren't computed here because a two-person clip needs the caller to ask
// "which one is you" first — see resolveSinglePersonSequence /
// linkPersonAcrossFrames / computePoseMetrics in poseAnalysis.js.
export async function extractFramesFromVideo(file, { maxWidth = 512, quality = 0.72, onProgress } = {}) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.style.position = "fixed";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  video.style.width = "1px";
  video.style.height = "1px";
  document.body.appendChild(video);

  // One pose-tracking session spans the whole video (probe pass and final
  // pass alike) so MediaPipe's VIDEO mode sees one continuous, increasing
  // timestamp sequence — this is what lets it track more smoothly than
  // treating every frame as a cold, isolated image. If the model can't
  // load at all (network issue, unsupported device), we fall back to the
  // old pixel-based motion detection for the whole run.
  let poseSession = null;
  try {
    poseSession = await createPoseSession();
  } catch (e) {
    poseSession = null;
  }

  try {
    video.src = url;
    await waitFor(video, "loadedmetadata");

    try {
      await video.play();
      video.pause();
    } catch (e) {
      // Autoplay may be blocked; seeking usually still works.
    }

    const duration = video.duration || 1;
    const targetCount = frameCountForDuration(duration);

    const vw = video.videoWidth || maxWidth;
    const vh = video.videoHeight || maxWidth;
    const width = Math.min(maxWidth, vw);
    const height = Math.round((vh / vw) * width) || width;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // First pass: sample candidate frames across the whole clip and score
    // the real body motion between consecutive ones (via pose tracking, so
    // we're measuring actual movement, not just changing pixels) to find
    // the moments with the most action — punches and fast exchanges show up
    // as motion spikes. Falls back to comparing raw pixels if pose tracking
    // isn't available this run. Uses just the first detected person for
    // scoring purposes — good enough to find "when did something happen",
    // identity doesn't matter yet at this stage.
    const probeW = 256;
    const probeH = Math.round((vh / vw) * probeW) || probeW;
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = probeW;
    probeCanvas.height = probeH;
    const probeCtx = probeCanvas.getContext("2d");

    const candidateCount = Math.min(30, Math.max(Math.round(targetCount * 2.5), 18));
    const candidates = [];
    let prevLandmarks = null;
    let prevPixelData = null;
    for (let i = 0; i < candidateCount; i++) {
      const t = Math.max(0, Math.min(duration - 0.05, (duration * i) / Math.max(candidateCount - 1, 1)));
      video.currentTime = t;
      await waitFor(video, "seeked");
      probeCtx.drawImage(video, 0, 0, probeW, probeH);

      let score = 0;
      if (poseSession) {
        const people = poseSession.detectAll(probeCanvas);
        const landmarks = people[0] || null;
        score = poseMotionScore(prevLandmarks, landmarks);
        prevLandmarks = landmarks;
      } else {
        const data = probeCtx.getImageData(0, 0, probeW, probeH).data;
        score = prevPixelData ? pixelMotionScore(data, prevPixelData) : 0;
        prevPixelData = data;
      }
      candidates.push({ t, score });
      onProgress?.({ phase: "probe", done: i + 1, total: candidateCount });
    }

    // Always keep the first and last frame for context (starting stance,
    // finishing position), then fill the rest with the highest-motion
    // moments, spaced apart so we don't cluster on a single flurry.
    const first = candidates[0];
    const last = candidates[candidates.length - 1];
    const middle = candidates.slice(1, -1);
    const minGap = duration / (targetCount * 1.5);

    const picked = [];
    for (const cand of [...middle].sort((a, b) => b.score - a.score)) {
      if (picked.length >= targetCount - 2) break;
      if (picked.some((p) => Math.abs(p.t - cand.t) < minGap)) continue;
      picked.push(cand);
    }

    const selected = [first, ...picked, last].filter(Boolean).sort((a, b) => a.t - b.t);

    // Second pass: redraw only the selected timestamps at full resolution
    // and run pose detection again at that resolution (more accurate than
    // the small probe frames) to draw real skeleton overlays — one color
    // per detected person — and collect the raw per-person landmarks for
    // whatever the caller needs to do with identity afterward.
    const frames = [];
    const framesPeople = [];
    const frameTimestamps = [];
    for (let i = 0; i < selected.length; i++) {
      const cand = selected[i];
      video.currentTime = cand.t;
      await waitFor(video, "seeked");
      ctx.drawImage(video, 0, 0, width, height);
      const people = poseSession ? poseSession.detectAll(canvas) : [];
      framesPeople.push(people);
      frameTimestamps.push(Math.round(cand.t * 10) / 10);
      drawSkeletons(canvas, people);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const frame = dataUrl.split(",")[1];
      frames.push(frame);
      onProgress?.({ phase: "final", done: i + 1, total: selected.length, frame });
    }

    if (frames.length === 0) {
      throw new Error("No frames extracted");
    }

    return { frames, framesPeople, frameTimestamps };
  } finally {
    URL.revokeObjectURL(url);
    document.body.removeChild(video);
    poseSession?.close();
  }
}
