// The One-Euro filter (Casiez, Roussel, Vogel 2012): an adaptive low-pass
// filter for noisy real-time signals. A fixed-alpha exponential moving
// average has to pick one tradeoff point between jitter suppression and
// lag; this can't be tuned to do both at once because it doesn't know how
// fast the signal is actually moving. One-Euro does: it filters
// aggressively while the signal is roughly still (kills jitter during a
// static guard) and relaxes as the derivative rises (avoids blunting a
// fast punch's real peak speed into the same shape as noise).
//
// minCutoff: raise to reduce lag at low speed, lower to reduce jitter at
// rest. beta: raise to cut more lag specifically during fast motion.

function smoothingFactor(dtSeconds, cutoff) {
  const r = 2 * Math.PI * cutoff * dtSeconds;
  return r / (r + 1);
}

function exponentialSmoothing(a, x, xPrev) {
  return a * x + (1 - a) * xPrev;
}

// A single scalar One-Euro filter. Track one per independent axis (x, y)
// of a tracked point.
export function createOneEuroFilter({ minCutoff = 1.5, beta = 0.7, dCutoff = 1.0 } = {}) {
  let xPrev = null;
  let dxPrev = 0;
  let tPrev = null;

  return function filter(x, tMs) {
    if (xPrev === null) {
      xPrev = x;
      tPrev = tMs;
      return x;
    }
    const dt = Math.max((tMs - tPrev) / 1000, 1e-3);

    const dx = (x - xPrev) / dt;
    const aD = smoothingFactor(dt, dCutoff);
    const dxHat = exponentialSmoothing(aD, dx, dxPrev);

    const cutoff = minCutoff + beta * Math.abs(dxHat);
    const a = smoothingFactor(dt, cutoff);
    const xHat = exponentialSmoothing(a, x, xPrev);

    xPrev = xHat;
    dxPrev = dxHat;
    tPrev = tMs;
    return xHat;
  };
}

// Convenience wrapper for a 2D { x, y } point — one One-Euro filter per axis.
export function createOneEuroFilter2D(options) {
  const fx = createOneEuroFilter(options);
  const fy = createOneEuroFilter(options);
  return function filter(point, tMs) {
    return { x: fx(point.x, tMs), y: fy(point.y, tMs) };
  };
}
