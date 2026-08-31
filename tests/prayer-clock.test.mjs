import assert from "node:assert/strict";
import test from "node:test";
import {
  angleForBucket,
  bucketIndexForDate,
  buildIntensityRing,
  PRAYER_CLOCK_BUCKETS
} from "../src/lib/prayer-clock.ts";

test("midnight is the top of the clock", () => {
  assert.ok(Math.abs(angleForBucket(0) + Math.PI / 2) < 0.05);
});

test("a prayer fills every overlapping 5-minute slot", () => {
  const startAt = new Date("2026-08-25T16:00:00.000Z");
  const now = new Date("2026-08-25T16:30:00.000Z");
  const events = [{ startedAt: startAt.toISOString(), minutes: 20 }];
  const ring = buildIntensityRing(events, now);
  const start = bucketIndexForDate(startAt);
  assert.ok(ring[start] > 0);
  assert.equal(ring.reduce((sum, value) => sum + value, 0) > 15, true);
  assert.equal(ring.length, PRAYER_CLOCK_BUCKETS);
});
