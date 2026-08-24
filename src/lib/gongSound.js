// Synthesizes a short gong-like tone with the Web Audio API for round
// start/end cues — no audio file to bundle, download, or license.
let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function playGong() {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    // A few layered sine partials with a fast attack and slow decay reads
    // as a struck metallic gong rather than a pure beep.
    const partials = [110, 164, 220, 330];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const peak = 0.3 / (i + 1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.9);
    });
  } catch (e) {
    // Sound is a nice-to-have, not critical — autoplay restrictions or an
    // unsupported browser shouldn't break the round flow.
  }
}

// A short, higher-pitched blip — marks the exact instant to throw during
// guided calibration, so the user isn't stuck watching text to time it.
export function playTick() {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch (e) {
    // Same as above — not critical to the flow.
  }
}
