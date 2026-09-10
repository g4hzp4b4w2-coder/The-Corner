// Generic round/phase state machine shared by every live training mode
// screen -- the native equivalent of the setup/prep/round/roundEnd/
// sessionEnd flow duplicated (identically) across all five of web's
// *Mode.jsx files. A mode screen supplies only what's actually
// mode-specific: what to reset at the start of a round (onRoundStart) and
// how to turn this round's accumulated state into a summary (onRoundEnd).
//
// Journal saving (note/competes/save-to-journal) is intentionally NOT part
// of this shell yet -- that needs the Supabase mobile client, which is
// Faz 4. sessionEnd here is just a local summary screen for now.
import { useCallback, useRef, useState } from 'react';
import { playGong } from '../lib/sound';

export type TrainingPhase = 'setup' | 'prep' | 'round' | 'roundEnd' | 'sessionEnd';

export const ROUND_DURATIONS = [60, 120, 180] as const;
const PREP_MS = 5000;

export interface UseTrainingSessionOptions<RoundSummary> {
  defaultRoundDuration?: (typeof ROUND_DURATIONS)[number];
  onRoundStart: (roundNumber: number, now: number) => void;
  onRoundEnd: (now: number) => RoundSummary;
}

export function useTrainingSession<RoundSummary>({
  defaultRoundDuration = 180,
  onRoundStart,
  onRoundEnd,
}: UseTrainingSessionOptions<RoundSummary>) {
  // Mirrors web's phaseRef: onFrame ticks arrive as a plain callback (not a
  // React effect), so the current phase must be readable synchronously,
  // not through a possibly-stale closure over state.
  const phaseRef = useRef<TrainingPhase>('setup');
  const phaseEndRef = useRef(0);
  const lastCountdownRef = useRef(-1);

  const [phase, setPhaseState] = useState<TrainingPhase>('setup');
  const [roundCount, setRoundCount] = useState(6);
  const [roundDuration, setRoundDuration] = useState<number>(defaultRoundDuration);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsHistory, setRoundsHistory] = useState<RoundSummary[]>([]);
  const [countdown, setCountdown] = useState(0);

  const setPhase = useCallback((p: TrainingPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const beginPrep = useCallback(
    (now: number) => {
      phaseEndRef.current = now + PREP_MS;
      lastCountdownRef.current = -1;
      setCountdown(Math.ceil(PREP_MS / 1000));
      setPhase('prep');
    },
    [setPhase],
  );

  const beginRound = useCallback(
    (roundNumber: number, now: number) => {
      onRoundStart(roundNumber, now);
      setCurrentRound(roundNumber);
      phaseEndRef.current = now + roundDuration * 1000;
      lastCountdownRef.current = -1;
      setCountdown(roundDuration);
      setPhase('round');
      playGong();
    },
    [onRoundStart, roundDuration, setPhase],
  );

  const endRound = useCallback(
    (now: number) => {
      playGong();
      const summary = onRoundEnd(now);
      setRoundsHistory((prev) => [...prev, summary]);
      setPhase('roundEnd');
    },
    [onRoundEnd, setPhase],
  );

  const start = useCallback(() => {
    setRoundsHistory([]);
    beginPrep(Date.now());
  }, [beginPrep]);

  const nextRound = useCallback(() => {
    setCurrentRound((round) => {
      beginRound(round + 1, Date.now());
      return round;
    });
  }, [beginRound]);

  const finishTraining = useCallback(() => {
    setPhase('sessionEnd');
  }, [setPhase]);

  const abortSession = useCallback(() => {
    setPhase('setup');
    setRoundsHistory([]);
  }, [setPhase]);

  // Call on every pose frame (~30/sec, see useCameraPose). Native has no
  // canvas-draw rAF loop to piggyback the round timer on like web does --
  // pose results already arrive at camera framerate, so they serve as the
  // tick source instead.
  const tick = useCallback(
    (now: number) => {
      const currentPhase = phaseRef.current;
      if (currentPhase !== 'prep' && currentPhase !== 'round') return;
      const remainingMs = phaseEndRef.current - now;
      if (remainingMs > 0) {
        const remainingSec = Math.ceil(remainingMs / 1000);
        if (remainingSec !== lastCountdownRef.current) {
          lastCountdownRef.current = remainingSec;
          setCountdown(remainingSec);
        }
      } else if (currentPhase === 'prep') {
        beginRound(1, now);
      } else {
        endRound(now);
      }
    },
    [beginRound, endRound],
  );

  const cameraActive = phase === 'prep' || phase === 'round' || phase === 'roundEnd';

  return {
    phase,
    phaseRef,
    cameraActive,
    roundCount,
    setRoundCount,
    roundDuration,
    setRoundDuration,
    currentRound,
    roundsHistory,
    countdown,
    start,
    nextRound,
    finishTraining,
    abortSession,
    tick,
  };
}
