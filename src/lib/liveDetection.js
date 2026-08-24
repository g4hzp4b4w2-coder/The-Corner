// Lightweight, fully client-side heuristic punch/guard detector run over a
// live pose landmark stream — no ML model or API call, just kinematics on
// MediaPipe's 33-point skeleton, cheap enough to run every frame. Good
// enough to count punches and flag a dropped guard as a training aid; not
// a boxing judge. The thresholds below are rough starting points meant to
// be tuned against real test sessions, not tuned against real footage yet.
//
// v2: the first version triggered a punch off wrist-to-shoulder DISTANCE
// (how far the hand got from the shoulder), which only really describes a
// straight punch. A hook keeps the elbow bent and sweeps sideways, and an
// uppercut stays fairly close to the body and travels mostly vertically —
// neither necessarily pushes the wrist far from the shoulder, so real
// testing (56 thrown, 18 counted) showed most hooks/uppercuts and even
// some straights going undetected. This version triggers on wrist SPEED
// instead — any fast burst of hand movement, in any direction — which
// covers all punch types the same way, then classifies the shape
// afterward from how the wrist moved during that burst.

const NOSE = 0;
const SHOULDER = { left: 11, right: 12 };
const WRIST = { left: 15, right: 16 };

// Loosened from the original 0.5 — MediaPipe's confidence on a fast-moving,
// motion-blurred wrist (exactly the moment we care about) often dips below
// that, and dropping the frame there was throwing away real punches.
const MIN_VISIBILITY = 0.4;
function visible(p) {
  return !!p && (p.visibility === undefined || p.visibility >= MIN_VISIBILITY);
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const PUNCH_COOLDOWN_MS = 300;
const MAX_MOVE_MS = 700; // a "moving" burst longer than this without settling isn't a punch
// Speed is in shoulder-widths per second, so it scales with distance from
// the camera.
const MOVE_SPEED_ON = 2.0;
// A real punch's speed dips at full extension before reversing, but
// rarely goes anywhere near zero — the hand is still moving, just
// changing direction. Trying to catch that "movement is over" moment
// with a mid-range OFF threshold (and later a debounce timer on top of
// it) proved impossible to tune: too high and the reversal itself got
// counted as a second punch, too aggressive a fix and noisy retractions
// missed the debounce window and got dropped entirely (both happened in
// testing). Setting OFF very low sidesteps the problem instead of trying
// to time it: only genuine near-stillness (hand actually resting back at
// guard) closes the movement, so one full extend-and-retract naturally
// stays a single movement throughout, including its mid-punch slowdown.
const MOVE_SPEED_OFF = 0.35;
// Minimum net distance the wrist has to travel from where the burst
// started, in shoulder-widths — filters out jitter/guard adjustments
// without requiring the large, straight-line reach the old distance-based
// trigger did (hooks and uppercuts travel less net distance than a jab).
const MIN_PUNCH_DISPLACEMENT = 0.25;

// A low or angled camera makes a normal guard look lower relative to the
// nose than a straight-on shot would, so this needs real margin before
// calling it a drop, and has to hold for a while first (not just a brief
// dip mid-combo) — first test feedback was that this was firing too easily.
const GUARD_DROP_MARGIN = 0.55;
const GUARD_DROP_MS = 900;
const GUARD_DROP_COOLDOWN_MS = 3000;

// dx/dy here are already normalized (relative-to-shoulder coordinates
// divided by shoulder width), no further scaling needed.
function classifyStyle(startRel, peakRel) {
  const dx = peakRel.x - startRel.x;
  const dy = peakRel.y - startRel.y; // normalized y grows downward
  if (-dy > Math.abs(dx) * 1.1) return "uppercut";
  if (Math.abs(dx) > 0.7) return "hook";
  return "straight";
}

function initArmState() {
  return {
    state: "idle", // idle | moving
    prevRel: null,
    prevT: null,
    moveStartT: null,
    moveStartRel: null,
    peakDist: 0,
    peakRel: null,
    lastPunchT: -Infinity,
    guardDropSinceT: null,
    lastGuardWarnT: -Infinity,
  };
}

// Returns a fresh detector with its own per-arm state machine. Call
// update(landmarks, t) once per frame with the current single-person
// landmarks and a monotonically increasing timestamp in ms (e.g.
// performance.now()); it returns any events that just happened.
export function createPunchDetector() {
  const arms = { left: initArmState(), right: initArmState() };
  // Cached rather than re-read every frame, so a momentarily-occluded
  // shoulder (e.g. crossed in front of the body during a punch) doesn't
  // stall scale normalization — only refreshed when both are confidently
  // visible.
  let shoulderWidth = 0.2;

  function update(landmarks, t) {
    const events = [];
    if (!landmarks) return events;

    const nose = landmarks[NOSE];
    const lSh = landmarks[SHOULDER.left];
    const rSh = landmarks[SHOULDER.right];
    if (visible(lSh) && visible(rSh)) {
      shoulderWidth = dist(lSh, rSh) || shoulderWidth;
    }

    for (const side of ["left", "right"]) {
      const wr = landmarks[WRIST[side]];
      const sh = landmarks[SHOULDER[side]];
      const arm = arms[side];
      // Tracked relative to this arm's own shoulder, not raw camera-frame
      // position — footwork, bouncing, weaving, or just walking toward the
      // camera moves the whole body (wrist included) without the arm doing
      // anything, and that used to read as fast wrist "speed" on its own.
      // Measuring the wrist against its own shoulder cancels out whole-body
      // motion and leaves only what the arm actually did.
      if (!visible(wr) || !visible(sh)) continue;
      const rel = { x: (wr.x - sh.x) / shoulderWidth, y: (wr.y - sh.y) / shoulderWidth };

      if (arm.prevRel && arm.prevT != null) {
        const dt = (t - arm.prevT) / 1000;
        if (dt > 0) {
          const speed = dist(rel, arm.prevRel) / dt;

          if (arm.state === "idle") {
            if (speed > MOVE_SPEED_ON && t - arm.lastPunchT > PUNCH_COOLDOWN_MS) {
              arm.state = "moving";
              arm.moveStartT = t;
              arm.moveStartRel = { ...arm.prevRel };
              arm.peakDist = 0;
              arm.peakRel = { ...rel };
            }
          } else {
            const distFromStart = dist(rel, arm.moveStartRel);
            if (distFromStart > arm.peakDist) {
              arm.peakDist = distFromStart;
              arm.peakRel = { ...rel };
            }

            const tooLong = t - arm.moveStartT > MAX_MOVE_MS;
            if (speed < MOVE_SPEED_OFF || tooLong) {
              if (arm.peakDist > MIN_PUNCH_DISPLACEMENT) {
                events.push({ type: "punch", side, style: classifyStyle(arm.moveStartRel, arm.peakRel), t });
                arm.lastPunchT = t;
              }
              arm.state = "idle";
            }
          }
        }
      }

      arm.prevRel = rel;
      arm.prevT = t;

      // Guard-drop: hand sitting below chin level for a sustained stretch
      // while that arm isn't mid-punch.
      if (visible(nose)) {
        const handDropped = wr.y > nose.y + shoulderWidth * GUARD_DROP_MARGIN;
        if (arm.state === "idle" && handDropped) {
          if (arm.guardDropSinceT == null) arm.guardDropSinceT = t;
          else if (t - arm.guardDropSinceT > GUARD_DROP_MS && t - arm.lastGuardWarnT > GUARD_DROP_COOLDOWN_MS) {
            events.push({ type: "guardDrop", side, t });
            arm.lastGuardWarnT = t;
          }
        } else {
          arm.guardDropSinceT = null;
        }
      }
    }

    return events;
  }

  return { update };
}
