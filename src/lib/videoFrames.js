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

export async function extractFramesFromVideo(file, { count = 12, maxWidth = 512, quality = 0.72 } = {}) {
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
    const vw = video.videoWidth || maxWidth;
    const vh = video.videoHeight || maxWidth;
    const width = Math.min(maxWidth, vw);
    const height = Math.round((vh / vw) * width) || width;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const frames = [];
    for (let i = 1; i <= count; i++) {
      const t = Math.max(0, Math.min(duration - 0.05, (duration * i) / (count + 1)));
      video.currentTime = t;
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
