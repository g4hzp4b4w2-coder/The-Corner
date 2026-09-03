// Detects a bag-work "thud" (glove hitting the bag) from a live microphone
// stream. No ML model — same adapt-to-the-moment approach already used for
// the vision punch detector: track a slow-moving ambient noise floor and
// flag a spike that jumps well above it, with a refractory window so one
// hit's decay tail can't register as a second hit.

// How much a frame's volume has to exceed the ambient floor to count as a
// hit. Multiplicative rather than a fixed number so it self-adjusts to a
// quiet home room vs. a loud gym's higher noise floor.
const SPIKE_RATIO = 2.2;
// Absolute floor under the ratio — in a near-silent room the ambient
// baseline can be close to zero, and a tiny ratio-based threshold would
// then trigger on the faintest sound.
const ABSOLUTE_MIN_SPIKE = 0.05;
// Ambient floor is an exponential moving average, updated only from
// non-hit frames so a hit's own loud moment can't drag the "quiet"
// baseline upward.
const BASELINE_ALPHA = 0.05;
// Minimum time between two counted hits — a real combination on a bag
// still has real gaps between shots; anything faster is one hit's ring-out
// re-triggering the detector.
const REFRACTORY_MS = 220;

// Root-mean-square amplitude of one Web Audio time-domain buffer (values
// centered on 128), roughly 0-1.
export function rmsOf(byteTimeDomainData) {
  let sum = 0;
  for (let i = 0; i < byteTimeDomainData.length; i++) {
    const v = (byteTimeDomainData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / byteTimeDomainData.length);
}

// How many frames to just observe before ever calling a hit — long enough
// to see the room's real ambient level (a loud gym reads loud from frame
// one, with no quiet lead-in to learn from), short enough that missing a
// hit landed in this window is a rare, bounded edge case rather than a
// real gap in coverage.
const BOOTSTRAP_FRAMES = 8;

export function createImpactDetector() {
  let baseline = null;
  const bootstrap = [];
  let lastHitT = -Infinity;

  // Call once per audio frame with the current RMS level and a
  // monotonically increasing timestamp in ms. Returns true the frame a hit
  // is confirmed.
  function update(rms, t) {
    if (baseline === null) {
      bootstrap.push(rms);
      if (bootstrap.length < BOOTSTRAP_FRAMES) return false;
      // The minimum, not the average, of these first frames: a real hit
      // landing inside the bootstrap window shouldn't be able to drag the
      // ambient estimate upward — the quietest frame seen is the best
      // guess at the room's true resting level.
      baseline = Math.min(...bootstrap);
      return false;
    }

    const threshold = Math.max(baseline * SPIKE_RATIO, ABSOLUTE_MIN_SPIKE);
    const isHit = rms > threshold && t - lastHitT > REFRACTORY_MS;
    if (isHit) {
      lastHitT = t;
    } else {
      baseline = BASELINE_ALPHA * rms + (1 - BASELINE_ALPHA) * baseline;
    }
    return isHit;
  }

  return { update };
}
