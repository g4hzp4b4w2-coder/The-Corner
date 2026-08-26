// Guided per-person calibration: instead of one universal set of speed
// thresholds trying to fit every body, camera angle, and skill level (which
// kept over- or under-counting in testing), have the user throw a few
// labeled punches on cue and measure THEIR actual numbers. Two things come
// out of this:
//   1. A personal floor/prominence for the live peak detector (see
//      liveDetection.js) instead of guessed universal constants.
//   2. Direction "templates" for straight/hook/uppercut, built from this
//      person's own punches, used to classify style by similarity instead
//      of a fixed angle rule.
//
// An earlier version also captured a freestyle combination to measure how
// much speed dips between back-to-back punches, and derived the live
// prominence threshold from that. Dropped it — a single ~3.5s capture
// turned out to be too noisy a sample on its own, and testing showed the
// resulting threshold swinging wildly (one run undercounted by a quarter,
// the next missed 70% of punches) purely from how that one combo happened
// to be thrown. The 6 isolated-punch measurements below are individually
// deliberate and clean, and there are enough of them to use a median —
// a steadier basis than one noisy multi-punch sample.

import { relWrist, shoulderWidthOf, dist } from "./poseMath";

export const CALIB_STEPS = [
  { key: "straight-left", side: "left", style: "straight", label: { tr: "Sol düz", en: "Left straight" }, leadInMs: 900, captureMs: 1600 },
  { key: "straight-right", side: "right", style: "straight", label: { tr: "Sağ düz", en: "Right straight" }, leadInMs: 900, captureMs: 1600 },
  { key: "hook-left", side: "left", style: "hook", label: { tr: "Sol kroşe", en: "Left hook" }, leadInMs: 900, captureMs: 1600 },
  { key: "hook-right", side: "right", style: "hook", label: { tr: "Sağ kroşe", en: "Right hook" }, leadInMs: 900, captureMs: 1600 },
  { key: "uppercut-left", side: "left", style: "uppercut", label: { tr: "Sol aparkat", en: "Left uppercut" }, leadInMs: 900, captureMs: 1600 },
  { key: "uppercut-right", side: "right", style: "uppercut", label: { tr: "Sağ aparkat", en: "Right uppercut" }, leadInMs: 900, captureMs: 1600 },
];

function speedSeriesFromRelSamples(samples) {
  const clean = samples.filter((s) => s.rel);
  const out = [];
  for (let i = 1; i < clean.length; i++) {
    const dt = (clean[i].t - clean[i - 1].t) / 1000;
    if (dt <= 0) continue;
    out.push({ t: clean[i].t, speed: dist(clean[i].rel, clean[i - 1].rel) / dt, rel: clean[i].rel });
  }
  return out;
}

function analyzeIsolated(samples) {
  const clean = samples.filter((s) => s.rel);
  if (clean.length < 2) return null;
  const series = speedSeriesFromRelSamples(samples);
  if (series.length === 0) return null;

  let peak = series[0];
  for (const s of series) if (s.speed > peak.speed) peak = s;

  const startRel = clean[0].rel;
  return {
    peakSpeed: peak.speed,
    dir: { x: peak.rel.x - startRel.x, y: peak.rel.y - startRel.y },
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Averages a pair of same-style direction vectors from opposite arms into
// one template. Horizontal reach (hook signature) is mirrored between
// arms, so it's averaged as magnitude; vertical reach (uppercut signature)
// is consistently upward for both arms, so it's averaged with sign.
function buildTemplate(a, b) {
  const dirs = [a, b].filter(Boolean);
  if (dirs.length === 0) return null;
  return {
    x: dirs.reduce((sum, d) => sum + Math.abs(d.x), 0) / dirs.length,
    y: dirs.reduce((sum, d) => sum + d.y, 0) / dirs.length,
  };
}

export function createCalibrationSession() {
  const recordings = {};
  let shoulderWidth = 0.2;

  function recordFrame(stepKey, side, landmarks, t) {
    shoulderWidth = shoulderWidthOf(landmarks, shoulderWidth);
    if (!recordings[stepKey]) recordings[stepKey] = [];
    recordings[stepKey].push({ t, rel: relWrist(landmarks, side, shoulderWidth) });
  }

  // Produces a calibration profile, or null if too little usable data
  // came out of the session (e.g. the camera lost tracking throughout) —
  // callers should fall back to generic defaults in that case.
  function finish() {
    const perType = {};
    for (const step of CALIB_STEPS) {
      if (!step.style) continue;
      const result = analyzeIsolated(recordings[step.key] || []);
      if (result) perType[step.key] = result;
    }

    const peakSpeeds = Object.values(perType)
      .map((r) => r.peakSpeed)
      .filter((v) => v > 0);
    if (peakSpeeds.length === 0) return null;

    const weakestPeak = Math.min(...peakSpeeds);
    const medianPeak = median(peakSpeeds);
    const floorThreshold = weakestPeak * 0.5;
    const minProminence = medianPeak * 0.45;

    return {
      floorThreshold,
      minProminence,
      templates: {
        straight: buildTemplate(perType["straight-left"]?.dir, perType["straight-right"]?.dir),
        hook: buildTemplate(perType["hook-left"]?.dir, perType["hook-right"]?.dir),
        uppercut: buildTemplate(perType["uppercut-left"]?.dir, perType["uppercut-right"]?.dir),
      },
    };
  }

  return { recordFrame, finish };
}
