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
// The last step also captures a short freestyle combination — punches
// thrown back-to-back don't fully reset the way an isolated punch does
// (less time to retract, momentum carries over), so measuring the actual
// dip between combo punches gives a much more realistic "how much does
// speed really drop between punches in a real exchange" number than
// assuming it behaves like isolated punches strung together.

import { relWrist, shoulderWidthOf, dist } from "./poseMath";

export const CALIB_STEPS = [
  { key: "straight-left", side: "left", style: "straight", label: { tr: "Sol düz", en: "Left straight" }, leadInMs: 900, captureMs: 1600 },
  { key: "straight-right", side: "right", style: "straight", label: { tr: "Sağ düz", en: "Right straight" }, leadInMs: 900, captureMs: 1600 },
  { key: "hook-left", side: "left", style: "hook", label: { tr: "Sol kroşe", en: "Left hook" }, leadInMs: 900, captureMs: 1600 },
  { key: "hook-right", side: "right", style: "hook", label: { tr: "Sağ kroşe", en: "Right hook" }, leadInMs: 900, captureMs: 1600 },
  { key: "uppercut-left", side: "left", style: "uppercut", label: { tr: "Sol aparkat", en: "Left uppercut" }, leadInMs: 900, captureMs: 1600 },
  { key: "uppercut-right", side: "right", style: "uppercut", label: { tr: "Sağ aparkat", en: "Right uppercut" }, leadInMs: 900, captureMs: 1600 },
  { key: "combo", side: "both", style: null, label: { tr: "Serbest kombinasyon (3-4 vuruş)", en: "Free combination (3-4 punches)" }, leadInMs: 900, captureMs: 3500 },
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

function findLocalPeaks(series, minGapMs, minSpeed) {
  const peaks = [];
  for (let i = 1; i < series.length - 1; i++) {
    const s = series[i];
    if (s.speed < minSpeed) continue;
    if (s.speed > series[i - 1].speed && s.speed >= series[i + 1].speed) {
      const last = peaks[peaks.length - 1];
      if (!last || s.t - last.t > minGapMs) {
        peaks.push(s);
      } else if (s.speed > last.speed) {
        peaks[peaks.length - 1] = s;
      }
    }
  }
  return peaks;
}

// Looks at the freestyle combo capture and measures how much speed
// actually dipped between consecutive punches — the number the live
// detector's "prominence" requirement is based on. Returns null if the
// capture didn't contain at least two clear punches to compare.
function analyzeCombo(samples, roughFloor) {
  const leftSeries = speedSeriesFromRelSamples(samples.map((s) => ({ t: s.t, rel: s.left })));
  const rightSeries = speedSeriesFromRelSamples(samples.map((s) => ({ t: s.t, rel: s.right })));
  const minSpeed = roughFloor || 1.0;
  const peaks = [...findLocalPeaks(leftSeries, 150, minSpeed), ...findLocalPeaks(rightSeries, 150, minSpeed)].sort((a, b) => a.t - b.t);
  if (peaks.length < 2) return null;

  const combined = [...leftSeries, ...rightSeries];
  const depths = [];
  for (let i = 1; i < peaks.length; i++) {
    const a = peaks[i - 1];
    const b = peaks[i];
    const between = combined.filter((s) => s.t > a.t && s.t < b.t);
    const minBetween = between.length ? Math.min(...between.map((s) => s.speed)) : Math.min(a.speed, b.speed) * 0.6;
    depths.push(Math.min(a.speed, b.speed) - minBetween);
  }
  const valid = depths.filter((d) => d > 0);
  return valid.length ? Math.min(...valid) : null;
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
    if (side === "both") {
      recordings[stepKey].push({ t, left: relWrist(landmarks, "left", shoulderWidth), right: relWrist(landmarks, "right", shoulderWidth) });
    } else {
      recordings[stepKey].push({ t, rel: relWrist(landmarks, side, shoulderWidth) });
    }
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
    const floorThreshold = weakestPeak * 0.45;

    const comboDip = analyzeCombo(recordings["combo"] || [], floorThreshold);
    const minProminence = comboDip != null ? comboDip * 0.75 : weakestPeak * 0.4;

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
