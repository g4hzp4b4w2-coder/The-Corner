// Native port of web's src/ShadowBoxingMode.jsx (Faz 3, first mode).
// Journal save (note/competes/save-to-journal) and the seeded-detector
// warm start (getPunchSampleSummary/summarizeSeed) both need the Supabase
// mobile client -- deferred to Faz 4, same as auth. This screen only shows
// a local session summary. i18n (web's lang tr/en) also deferred; Turkish
// only for now, matching the rest of this app's native screens so far.
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { createPunchDetector } from '@the-corner/core/liveDetection';
import { useCameraPose, type OnPoseFrame } from '../hooks/useCameraPose';
import { useTrainingSession, ROUND_DURATIONS } from '../training/useTrainingSession';
import { TrainingCamera } from '../components/TrainingCamera';

type RoundStats = {
  left: number;
  right: number;
  straight: number;
  hook: number;
  uppercut: number;
  guardDrops: number;
};

type RoundSummary = RoundStats & { confidence: 'high' | 'medium' | 'low' };

type PunchEvent = { type: 'punch'; side: 'left' | 'right'; style: 'straight' | 'hook' | 'uppercut'; t: number };
type GuardDropEvent = { type: 'guardDrop'; side: 'left' | 'right'; t: number };

const emptyRoundStats: RoundStats = { left: 0, right: 0, straight: 0, hook: 0, uppercut: 0, guardDrops: 0 };

const STYLE_LABEL: Record<string, string> = { straight: 'Düz', hook: 'Hook', uppercut: 'Uppercut' };
const SIDE_LABEL: Record<string, string> = { left: 'Sol kol', right: 'Sağ kol' };

function sumStats(list: RoundStats[]): RoundStats {
  return list.reduce(
    (acc, r) => ({
      left: acc.left + r.left,
      right: acc.right + r.right,
      straight: acc.straight + r.straight,
      hook: acc.hook + r.hook,
      uppercut: acc.uppercut + r.uppercut,
      guardDrops: acc.guardDrops + r.guardDrops,
    }),
    { ...emptyRoundStats },
  );
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Same reasoning as web's confidenceLevel: bladed stance shrinks the
// shoulder-width the whole detector normalizes by, so surface it as an
// honest confidence level instead of presenting every count as equally
// trustworthy.
function confidenceLevel(diagnostics: { minShoulderWidthRatio: number } | undefined): 'high' | 'medium' | 'low' {
  if (!diagnostics) return 'high';
  if (diagnostics.minShoulderWidthRatio >= 0.72) return 'high';
  if (diagnostics.minShoulderWidthRatio >= 0.5) return 'medium';
  return 'low';
}

const CONFIDENCE_COPY: Record<'high' | 'medium' | 'low', { label: string; hint?: string; color: string }> = {
  high: { label: 'Yüksek güven', color: '#34d399' },
  medium: { label: 'Orta güven', hint: 'Kameraya daha dönük dur, sayım daha güvenilir olur.', color: '#fbbf24' },
  low: { label: 'Düşük güven', hint: 'Kameraya daha dönük dur, sayım daha güvenilir olur.', color: '#f87171' },
};

function StatsGrid({ stats }: { stats: RoundStats }) {
  const total = stats.left + stats.right;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{SIDE_LABEL.left}</Text>
          <Text style={styles.statValue}>{stats.left}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{SIDE_LABEL.right}</Text>
          <Text style={styles.statValue}>{stats.right}</Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statRowLabel}>Toplam yumruk</Text>
        <Text style={styles.statRowValueRed}>{total}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statRowLabel}>Guard düşüşü</Text>
        <Text style={styles.statRowValue}>{stats.guardDrops}</Text>
      </View>
    </View>
  );
}

export function ShadowBoxingScreen({ onBack }: { onBack?: () => void }) {
  const detectorRef = useRef(createPunchDetector());
  const roundStatsRef = useRef<RoundStats>({ ...emptyRoundStats });
  const guardWarnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roundStats, setRoundStats] = useState<RoundStats>({ ...emptyRoundStats });
  const [events, setEvents] = useState<(PunchEvent | GuardDropEvent)[]>([]);
  const [guardWarning, setGuardWarning] = useState(false);

  const handleEvents = useCallback((newEvents: (PunchEvent | GuardDropEvent)[]) => {
    if (newEvents.length === 0) return;
    const next = { ...roundStatsRef.current };
    for (const ev of newEvents) {
      if (ev.type === 'punch') {
        next[ev.side] += 1;
        next[ev.style] += 1;
      } else {
        next.guardDrops += 1;
      }
    }
    roundStatsRef.current = next;
    setRoundStats(next);
    setEvents((prev) => [...newEvents, ...prev].slice(0, 6));
    if (newEvents.some((ev) => ev.type === 'guardDrop')) {
      setGuardWarning(true);
      if (guardWarnTimeoutRef.current) clearTimeout(guardWarnTimeoutRef.current);
      guardWarnTimeoutRef.current = setTimeout(() => setGuardWarning(false), 1200);
    }
  }, []);

  const session = useTrainingSession<RoundSummary>({
    onRoundStart: () => {
      // Deliberately a fresh detector every round (unlike Combo Drill) --
      // shadow boxing has no warm-up dependency reason to keep one across
      // rounds, and it matches web's ShadowBoxingMode exactly.
      detectorRef.current = createPunchDetector();
      roundStatsRef.current = { ...emptyRoundStats };
      setRoundStats({ ...emptyRoundStats });
      setEvents([]);
      setGuardWarning(false);
    },
    onRoundEnd: () => {
      const diagnostics = detectorRef.current.getDiagnostics?.();
      return { ...roundStatsRef.current, confidence: confidenceLevel(diagnostics) };
    },
  });

  const onFrame = useCallback<OnPoseFrame>(
    (landmarks, _raw, now) => {
      session.tick(now);
      if (session.phaseRef.current === 'round') {
        const newEvents = detectorRef.current.update(landmarks.length ? landmarks : null, now) as (
          | PunchEvent
          | GuardDropEvent
        )[];
        handleEvents(newEvents);
      }
    },
    [session, handleEvents],
  );

  const camera = useCameraPose(onFrame);

  const lastRound = session.roundsHistory[session.roundsHistory.length - 1];
  const totals = useMemo(() => sumStats(session.roundsHistory), [session.roundsHistory]);

  if (!camera.hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Gölge boksu için kamera izni gerekiyor.</Text>
        <Pressable style={styles.primaryButton} onPress={camera.requestPermission}>
          <Text style={styles.primaryButtonText}>İzin ver</Text>
        </Pressable>
      </View>
    );
  }

  if (!camera.device) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Ön kamera bulunamadı.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {session.phase === 'setup' && (
        <View style={{ padding: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {onBack && (
              <Pressable onPress={onBack}>
                <Text style={styles.backText}>{'< Geri'}</Text>
              </Pressable>
            )}
            <Text style={styles.subtitle}>Kaç raund çalışacaksın ve raund süresi ne kadar olsun?</Text>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Raund sayısı</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable style={styles.stepperButton} onPress={() => session.setRoundCount((n) => Math.max(1, n - 1))}>
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{session.roundCount}</Text>
              <Pressable style={styles.stepperButton} onPress={() => session.setRoundCount((n) => Math.min(12, n + 1))}>
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Raund süresi</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {ROUND_DURATIONS.map((sec) => (
                <Pressable
                  key={sec}
                  onPress={() => session.setRoundDuration(sec)}
                  style={[styles.durationChip, session.roundDuration === sec && styles.durationChipActive]}
                >
                  <Text style={session.roundDuration === sec ? styles.durationChipTextActive : styles.durationChipText}>
                    {sec / 60} dk
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={session.start}>
            <Text style={styles.primaryButtonText}>Başla</Text>
          </Pressable>
        </View>
      )}

      {session.cameraActive && (
        <View style={{ padding: 16, gap: 12 }}>
          <TrainingCamera
            device={camera.device}
            isActive={session.cameraActive}
            frameProcessor={camera.frameProcessor}
            cameraViewLayoutChangeHandler={camera.cameraViewLayoutChangeHandler}
            landmarks={camera.rawLandmarks}
            style={{ height: 320 }}
          >
            <Pressable style={styles.closeButton} onPress={session.abortSession}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>

            {session.phase === 'round' && (
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeText}>
                  Raund {session.currentRound}/{session.roundCount} · {formatClock(session.countdown)}
                </Text>
              </View>
            )}

            {session.phase === 'prep' && (
              <View style={styles.prepOverlay}>
                <Text style={styles.prepCountdown}>{session.countdown}</Text>
                <Text style={styles.prepLabel}>Hazırlan, kamerayı yerleştir</Text>
              </View>
            )}

            {guardWarning && session.phase === 'round' && (
              <View style={styles.guardWarning}>
                <Text style={styles.guardWarningText}>Guard açık!</Text>
              </View>
            )}
          </TrainingCamera>

          {session.phase === 'round' && (
            <View style={{ gap: 10 }}>
              <StatsGrid stats={roundStats} />
              {events.length > 0 && (
                <View style={styles.eventsCard}>
                  <Text style={styles.eventsTitle}>Son hareketler</Text>
                  {events.map((ev, i) => (
                    <Text key={i} style={styles.eventLine}>
                      {SIDE_LABEL[ev.side]}
                      {ev.type === 'punch' ? ` · ${STYLE_LABEL[ev.style]}` : ' · guard düştü'}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {session.phase === 'roundEnd' && lastRound && (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionTitle}>Raund özeti · Raund {session.currentRound}</Text>
              <StatsGrid stats={lastRound} />
              <View style={[styles.confidenceBadge, { borderColor: CONFIDENCE_COPY[lastRound.confidence].color }]}>
                <Text style={{ color: CONFIDENCE_COPY[lastRound.confidence].color, fontSize: 12, fontWeight: '600' }}>
                  {CONFIDENCE_COPY[lastRound.confidence].label}
                </Text>
                {CONFIDENCE_COPY[lastRound.confidence].hint && (
                  <Text style={styles.confidenceHint}>{CONFIDENCE_COPY[lastRound.confidence].hint}</Text>
                )}
              </View>
              {session.currentRound < session.roundCount ? (
                <Pressable style={styles.primaryButton} onPress={session.nextRound}>
                  <Text style={styles.primaryButtonText}>Sonraki raund</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.primaryButton} onPress={session.finishTraining}>
                  <Text style={styles.primaryButtonText}>Antrenmanı bitir</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {session.phase === 'sessionEnd' && (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={styles.sectionTitle}>Antrenman özeti</Text>
          <StatsGrid stats={totals} />
          <View style={{ gap: 6 }}>
            {session.roundsHistory.map((r, i) => (
              <View key={i} style={styles.statRow}>
                <Text style={styles.statRowLabel}>Raund {i + 1}</Text>
                <Text style={styles.statRowValue}>
                  {r.left + r.right} yumruk · {r.guardDrops} guard düşüşü
                </Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.secondaryButton} onPress={session.abortSession}>
            <Text style={styles.secondaryButtonText}>Yeni antrenman</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#0a0a0a' },
  text: { color: '#fff', fontSize: 16, textAlign: 'center' },
  backText: { color: '#a3a3a3', fontSize: 15 },
  subtitle: { color: '#a3a3a3', fontSize: 12, flexShrink: 1 },
  fieldLabel: { color: '#a3a3a3', fontSize: 12, marginBottom: 8 },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
  },
  stepperButtonText: { color: '#d4d4d4', fontSize: 18 },
  stepperValue: { color: '#f5f5f5', fontSize: 18, fontWeight: '500', width: 32, textAlign: 'center' },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#0a0a0a',
  },
  durationChipActive: { backgroundColor: '#450a0a', borderColor: '#7f1d1d' },
  durationChipText: { color: '#737373', fontSize: 12 },
  durationChipTextActive: { color: '#f87171', fontSize: 12 },
  primaryButton: { width: '100%', backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  primaryButtonText: { color: '#0a0a0a', fontWeight: '600', fontSize: 14 },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#d4d4d4', fontSize: 14 },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10,10,10,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { color: '#a3a3a3', fontSize: 16, lineHeight: 18 },
  roundBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(10,10,10,0.7)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roundBadgeText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  prepOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,10,10,0.6)',
  },
  prepCountdown: { color: '#f5f5f5', fontSize: 40, fontWeight: '600' },
  prepLabel: { color: '#a3a3a3', fontSize: 12 },
  guardWarning: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#dc2626', paddingVertical: 6 },
  guardWarningText: { color: '#0a0a0a', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  statCard: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#262626', borderRadius: 8, padding: 10, alignItems: 'center' },
  statLabel: { color: '#737373', fontSize: 10, marginBottom: 2 },
  statValue: { color: '#f5f5f5', fontSize: 18, fontWeight: '500' },
  statRow: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statRowLabel: { color: '#737373', fontSize: 12 },
  statRowValue: { color: '#d4d4d4', fontSize: 14, fontWeight: '500' },
  statRowValueRed: { color: '#ef4444', fontSize: 16, fontWeight: '500' },
  eventsCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#262626', borderRadius: 8, padding: 10, gap: 4 },
  eventsTitle: { color: '#737373', fontSize: 10, marginBottom: 2 },
  eventLine: { color: '#d4d4d4', fontSize: 12 },
  sectionTitle: { color: '#d4d4d4', fontSize: 14, fontWeight: '500' },
  confidenceBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  confidenceHint: { color: '#a3a3a3', fontSize: 11 },
});
