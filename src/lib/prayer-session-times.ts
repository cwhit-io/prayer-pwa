const CAMPAIGN_TIME_ZONE = "America/Indiana/Indianapolis";

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second"))
  };
}

/** Instant when `timeZone` wall time is `ymd` at `hour`:`minute`. */
export function zonedLocalDate(
  ymd: string,
  hour: number,
  minute = 0,
  timeZone = CAMPAIGN_TIME_ZONE
) {
  const [year, month, day] = ymd.split("-").map(Number);
  const intended = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = intended;
  for (let i = 0; i < 4; i += 1) {
    const seen = zonedParts(new Date(utc), timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    utc += intended - seenAsUtc;
  }
  return new Date(utc);
}

export function readDate(value: string, fallback: Date) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/** Date-only values are Fort Wayne noon so the calendar day matches the church timezone. */
export function readPrayerDate(value: string, fallback: Date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return zonedLocalDate(value, 12, 0);
  }
  return readDate(value, fallback);
}

/**
 * Manual "today" entries used to stamp noon UTC, which is still in the future
 * before ~8am Fort Wayne, so start was after end and save failed.
 */
export function resolveSessionTimes(input: {
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  now: Date;
}) {
  const durationMs = Math.max(1, input.minutes) * 60_000;
  let { startedAt, endedAt } = input;
  if (startedAt.getTime() > input.now.getTime()) {
    endedAt = input.now;
    startedAt = new Date(endedAt.getTime() - durationMs);
  } else if (startedAt.getTime() > endedAt.getTime()) {
    endedAt = new Date(startedAt.getTime() + durationMs);
    if (endedAt.getTime() > input.now.getTime()) {
      endedAt = input.now;
      startedAt = new Date(endedAt.getTime() - durationMs);
    }
  }
  return { startedAt, endedAt };
}
