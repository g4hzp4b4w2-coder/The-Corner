import { test } from "node:test";
import assert from "node:assert/strict";
import { createOneEuroFilter, createOneEuroFilter2D } from "../src/oneEuroFilter.js";

test("createOneEuroFilter: first call returns the raw value unchanged", () => {
  const filter = createOneEuroFilter();
  assert.equal(filter(1.5, 0), 1.5);
});

test("createOneEuroFilter: smooths a step input (output stays between old and new)", () => {
  const filter = createOneEuroFilter();
  filter(0, 0);
  const out = filter(10, 16); // ~16ms later, one frame at 60fps
  assert.ok(out > 0 && out < 10, `expected smoothed value strictly between 0 and 10, got ${out}`);
});

test("createOneEuroFilter: converges toward a held constant value", () => {
  const filter = createOneEuroFilter();
  let out = filter(0, 0);
  for (let i = 1; i <= 60; i++) out = filter(5, i * 16);
  assert.ok(Math.abs(out - 5) < 0.05, `expected convergence near 5, got ${out}`);
});

test("createOneEuroFilter2D: filters x and y independently", () => {
  const filter = createOneEuroFilter2D();
  const first = filter({ x: 1, y: 2 }, 0);
  assert.deepEqual(first, { x: 1, y: 2 });
  const second = filter({ x: 11, y: 2 }, 16);
  assert.ok(second.x > 1 && second.x < 11);
  assert.ok(Math.abs(second.y - 2) < 1e-9); // y didn't move, should stay put
});
