import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeBalance, computeWeeklySpeedTrend, hasPowerIncrease } from "../src/punchStats.js";

test("summarizeBalance: null until at least 5 samples per side", () => {
  const samples = [
    { side: "left", speed: 1 },
    { side: "left", speed: 2 },
    { side: "right", speed: 1 },
  ];
  assert.equal(summarizeBalance(samples), null);
});

test("summarizeBalance: averages per side once there's enough data", () => {
  const samples = [
    ...Array(5).fill({ side: "left", speed: 2 }),
    ...Array(5).fill({ side: "right", speed: 4 }),
  ];
  const result = summarizeBalance(samples);
  assert.equal(result.leftAvgSpeed, 2);
  assert.equal(result.rightAvgSpeed, 4);
  assert.equal(result.sampleCount, 10);
});

test("computeWeeklySpeedTrend: returns one bucket per week, null avg for empty weeks", () => {
  const now = new Date("2026-01-14T12:00:00Z").getTime(); // a Wednesday
  const buckets = computeWeeklySpeedTrend([], 3, "en", now);
  assert.equal(buckets.length, 3);
  assert.equal(buckets[buckets.length - 1].label, "This wk");
  assert.ok(buckets.every((b) => b.avg === null));
});

test("computeWeeklySpeedTrend: buckets a sample into its own week", () => {
  const now = new Date("2026-01-14T12:00:00Z").getTime();
  const samples = [{ createdAt: now, speed: 3 }, { createdAt: now, speed: 5 }];
  const buckets = computeWeeklySpeedTrend(samples, 2, "tr", now);
  assert.equal(buckets[buckets.length - 1].avg, 4);
});

test("hasPowerIncrease: false without enough samples in both windows", () => {
  const now = Date.now();
  assert.equal(hasPowerIncrease([{ createdAt: now, speed: 10 }], now), false);
});

test("hasPowerIncrease: true when this month averages >5% faster than last month", () => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const samples = [
    ...Array(8).fill(0).map(() => ({ createdAt: now - 5 * DAY, speed: 10 })),
    ...Array(8).fill(0).map(() => ({ createdAt: now - 45 * DAY, speed: 5 })),
  ];
  assert.equal(hasPowerIncrease(samples, now), true);
});
