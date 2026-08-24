// Lightweight, fully client-side heuristic punch/guard detector run over a
// live pose landmark stream — no ML model or API call, just kinematics on
// MediaPipe's 33-point skeleton, cheap enough to run every frame. Good
// enough to count punches and flag a dropped guard as a training aid; not
// a boxing judge. The thresholds below are rough starting points meant to
// be tuned against real test sessions, not tuned against real footage yet.

const NOSE = 0;
const SHOULDER = { left: 11, right: 12 };
const WRIST = { left: 15, right: 16 };

const MIN_VISIBILITY = 0.5;
function visible(p) {
  return !!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY);
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const PUNCH_COOLDOWN_MS = 300;
const MAX_EXTENSION_MS = 800; // arm held out this long without retracting isn't treated as a punch
// A low or angled camera makes a normal guard look lower relative to the
// nose than a straight-on shot would, so this needs real margin before
// calling it a drop, and has to hold for a while first (not just a brief
// dip mid-combo) — first test feedback was that this was firing too easily.
const GUARD_DROP_MARGIN = 0.55;
const GUARD_DROP_MS = 900;
const GUARD_DROP_COOLDOWN_MS = 3000;
// Both ratios are wrist-to-shoulder distance divided by shoulder width, so
// they scale with how close the user stands to the camera.
const EXTEND_RATIO_THRESHOLD = 1.55;
const RETRACT_RATIO_THRESHOLD = 1.15;

function classifyStyle(startWrist, peakWrist, shoulderWidth) {
  const dx = (peakWrist.x - startWrist.x) / shoulderWidth;
  const dy = (peakWrist.y - startWrist.y) / shoulderWidth; // normalized y grows downward
  if (-dy > Math.abs(dx) * 1.2) return "uppercut";
  if (Math.abs(dx) > 0.9) return "hook";
  return "straight";
}

// Returns a fresh detector with its own per-arm state machine. Call
// update(landmarks, t) once per frame with the current single-person
// landmarks and a monotonically increasing timestamp in ms (e.g.
// performance.now()); it returns any events that just happened.
export function createPunchDetector() {
  const arms = {
    left: { state: "guard", startT: null, startWrist: null, peakRatio: 0, peakWrist: null, lastPunchT: -Infinity, guardDropSinceT: null, lastGuardWarnT: -Infinity },
    right: { state: "guard", startT: null, startWrist: null, peakRatio: 0, peakWrist: null, lastPunchT: -Infinity, guardDropSinceT: null, lastGuardWarnT: -Infinity },
  };

  function update(landmarks, t) {
    const events = [];
    if (!landmarks) return events;
    const nose = landmarks[NOSE];
    const lSh = landmarks[SHOULDER.left];
    const rSh = landmarks[SHOULDER.right];
    if (!visible(nose) || !visible(lSh) || !visible(rSh)) return events;
    const shoulderWidth = dist(lSh, rSh) || 0.2;

    for (const side of ["left", "right"]) {
      const sh = landmarks[SHOULDER[side]];
      const wr = landmarks[WRIST[side]];
      if (!visible(sh) || !visible(wr)) continue;
      const arm = arms[side];
      const ratio = dist(sh, wr) / shoulderWidth;

      if (arm.state === "guard") {
        if (ratio > EXTEND_RATIO_THRESHOLD && t - arm.lastPunchT > PUNCH_COOLDOWN_MS) {
          arm.state = "extending";
          arm.startT = t;
          arm.startWrist = { x: wr.x, y: wr.y };
          arm.peakRatio = ratio;
          arm.peakWrist = { x: wr.x, y: wr.y };
        }
      } else if (arm.state === "extending") {
        if (ratio > arm.peakRatio) {
          arm.peakRatio = ratio;
          arm.peakWrist = { x: wr.x, y: wr.y };
        }
        if (ratio < RETRACT_RATIO_THRESHOLD) {
          events.push({ type: "punch", side, style: classifyStyle(arm.startWrist, arm.peakWrist, shoulderWidth), t });
          arm.lastPunchT = t;
          arm.state = "guard";
        } else if (t - arm.startT > MAX_EXTENSION_MS) {
          arm.state = "guard"; // held out, not a punch — drop it without counting
        }
      }

      // Guard-drop: hand sitting below chin level for a sustained stretch
      // while that arm isn't mid-punch.
      const handDropped = wr.y > nose.y + shoulderWidth * GUARD_DROP_MARGIN;
      if (arm.state === "guard" && handDropped) {
        if (arm.guardDropSinceT == null) arm.guardDropSinceT = t;
        else if (t - arm.guardDropSinceT > GUARD_DROP_MS && t - arm.lastGuardWarnT > GUARD_DROP_COOLDOWN_MS) {
          events.push({ type: "guardDrop", side, t });
          arm.lastGuardWarnT = t;
        }
      } else {
        arm.guardDropSinceT = null;
      }
    }

    return events;
  }

  return { update };
}
