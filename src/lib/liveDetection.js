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

const PUNCH_COOLDOWN_MS = 250;
const MAX_MOVE_MS = 700; // a "moving" burst longer than this without settling isn't a punch
// Speed is in shoulder-widths per second, so it scales with distance from
// the camera. Needs a real burst to start counting, and has to actually
// settle back down (not just dip) before it can count again.
const MOVE_SPEED_ON = 2.0;
const MOVE_SPEED_OFF = 0.8;
// Speed dips briefly near zero right at full extension, before the arm
// reverses to retract — without this, that natural inflection point got
// misread as "movement over" and the retraction counted as a second
// punch. Speed has to stay below MOVE_SPEED_OFF continuously for this
// long before a movement is considered actually finished, which folds
// the whole out-and-back of one strike into a single counted punch.
const SETTLE_MS = 110;
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

function classifyStyle(startWrist, peakWrist, shoulderWidth) {
  const dx = (peakWrist.x - startWrist.x) / shoulderWidth;
  const dy = (peakWrist.y - startWrist.y) / shoulderWidth; // normalized y grows downward
  if (-dy > Math.abs(dx) * 1.1) return "uppercut";
  if (Math.abs(dx) > 0.7) return "hook";
  return "straight";
}

function initArmState() {
  return {
    state: "idle", // idle | moving
    prevWrist: null,
    prevT: null,
    moveStartT: null,
    moveStartWrist: null,
    peakDist: 0,
    peakWrist: null,
    belowOffSinceT: null,
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
      const arm = arms[side];
      if (!visible(wr)) continue;

      if (arm.prevWrist && arm.prevT != null) {
        const dt = (t - arm.prevT) / 1000;
        if (dt > 0) {
          const speed = dist(wr, arm.prevWrist) / dt / shoulderWidth;

          if (arm.state === "idle") {
            if (speed > MOVE_SPEED_ON && t - arm.lastPunchT > PUNCH_COOLDOWN_MS) {
              arm.state = "moving";
              arm.moveStartT = t;
              arm.moveStartWrist = { x: arm.prevWrist.x, y: arm.prevWrist.y };
              arm.peakDist = 0;
              arm.peakWrist = { x: wr.x, y: wr.y };
              arm.belowOffSinceT = null;
            }
          } else {
            const distFromStart = dist(wr, arm.moveStartWrist) / shoulderWidth;
            if (distFromStart > arm.peakDist) {
              arm.peakDist = distFromStart;
              arm.peakWrist = { x: wr.x, y: wr.y };
            }

            if (speed < MOVE_SPEED_OFF) {
              if (arm.belowOffSinceT == null) arm.belowOffSinceT = t;
            } else {
              arm.belowOffSinceT = null;
            }

            const tooLong = t - arm.moveStartT > MAX_MOVE_MS;
            const settled = arm.belowOffSinceT != null && t - arm.belowOffSinceT > SETTLE_MS;
            if (settled || tooLong) {
              // A noisy retraction can miss a clean SETTLE_MS window and
              // only close out via the tooLong fallback — that must not
              // disqualify an otherwise real punch (this exact bug dropped
              // detection to near zero in testing: almost every punch hit
              // tooLong instead of settled, and used to get thrown away
              // here regardless of how far the wrist had actually moved).
              if (arm.peakDist > MIN_PUNCH_DISPLACEMENT) {
                events.push({ type: "punch", side, style: classifyStyle(arm.moveStartWrist, arm.peakWrist, shoulderWidth), t });
                arm.lastPunchT = t;
              }
              arm.state = "idle";
              arm.belowOffSinceT = null;
            }
          }
        }
      }

      arm.prevWrist = { x: wr.x, y: wr.y };
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
