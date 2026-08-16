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

function motionScore(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const ga = (a[i] + a[i + 1] + a[i + 2]) / 3;
    const gb = (b[i] + b[i + 1] + b[i + 2]) / 3;
    sum += Math.abs(ga - gb);
  }
  return sum;
}

export async function extractFramesFromVideo(file, { maxWidth = 512, quality = 0.72 } = {}) {
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

    // First pass: sample many small, cheap frames and score motion between
    // consecutive ones (sum of pixel deltas) to find the moments with the
    // most movement — punches and fast exchanges show up as motion spikes.
    const probeW = 48;
    const probeH = Math.round((vh / vw) * probeW) || probeW;
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = probeW;
    probeCanvas.height = probeH;
    const probeCtx = probeCanvas.getContext("2d");

    const candidateCount = Math.min(30, Math.max(Math.round(targetCount * 2.5), 18));
    const candidates = [];
    let prevData = null;
    for (let i = 0; i < candidateCount; i++) {
      const t = Math.max(0, Math.min(duration - 0.05, (duration * i) / Math.max(candidateCount - 1, 1)));
      video.currentTime = t;
      await waitFor(video, "seeked");
      probeCtx.drawImage(video, 0, 0, probeW, probeH);
      const data = probeCtx.getImageData(0, 0, probeW, probeH).data;
      candidates.push({ t, score: prevData ? motionScore(data, prevData) : 0 });
      prevData = data;
    }

    // Always keep the first and last frame for context (starting stance,
    // finishing position), then fill the rest with the highest-motion
    // moments, spaced apart so we don't cluster on a single flurry.
    const first = candidates[0];
    const last = candidates[candidates.length - 1];
    const middle = candidates.slice(1, -1);
    const minGap = duration / (targetCount * 1.5);

    const picked = [];
    for (const c of [...middle].sort((a, b) => b.score - a.score)) {
      if (picked.length >= targetCount - 2) break;
      if (picked.some((p) => Math.abs(p.t - c.t) < minGap)) continue;
      picked.push(c);
    }

    const selected = [first, ...picked, last].filter(Boolean).sort((a, b) => a.t - b.t);

    // Second pass: redraw only the selected timestamps at full resolution.
    const frames = [];
    for (const c of selected) {
      video.currentTime = c.t;
      await waitFor(video, "seeked");
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      frames.push(dataUrl.split(",")[1]);
    }

    if (frames.length === 0) {
      throw new Error("No frames extracted");
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
    document.body.removeChild(video);
  }
}
