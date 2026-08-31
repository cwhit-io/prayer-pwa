import assert from "node:assert/strict";
import test from "node:test";
import { readPrayerDate, resolveSessionTimes, zonedLocalDate } from "../src/lib/prayer-session-times.ts";

test("Fort Wayne noon on a calendar date is 12:00 there, not 12:00 UTC", () => {
  const noon = zonedLocalDate("2026-08-26", 12, 0);
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    hour: "2-digit",
    hourCycle: "h23"
  }).format(noon);
  assert.equal(hour, "12");
});

test("logging today before local noon no longer places start after now", () => {
  const now = new Date("2026-08-26T05:30:00Z"); // 1:30am Fort Wayne
  const startedAt = readPrayerDate("2026-08-26", now);
  const { startedAt: start, endedAt: end } = resolveSessionTimes({
    startedAt,
    endedAt: now,
    minutes: 15,
    now
  });
  assert.ok(start.getTime() < end.getTime());
  assert.equal(end.getTime(), now.getTime());
  assert.equal(end.getTime() - start.getTime(), 15 * 60_000);
});

test("logging later in the same day still uses Fort Wayne noon as start", () => {
  const now = new Date("2026-08-26T20:00:00Z"); // 4pm Fort Wayne
  const startedAt = readPrayerDate("2026-08-26", now);
  const { startedAt: start, endedAt: end } = resolveSessionTimes({
    startedAt,
    endedAt: now,
    minutes: 15,
    now
  });
  assert.ok(start.getTime() < end.getTime());
  assert.equal(start.getTime(), startedAt.getTime());
  assert.equal(end.getTime(), now.getTime());
});
