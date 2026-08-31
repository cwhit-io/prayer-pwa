const TIME_ZONE = "America/Indiana/Indianapolis";

export const PRAYER_CLOCK_BUCKET_MINUTES = 5;
export const PRAYER_CLOCK_BUCKETS = (24 * 60) / PRAYER_CLOCK_BUCKET_MINUTES;

export type PrayerClockEvent = {
  startedAt: string;
  minutes: number;
};

export function fortWayneMinutesOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function bucketIndexForDate(date: Date) {
  return Math.min(
    PRAYER_CLOCK_BUCKETS - 1,
    Math.floor(fortWayneMinutesOfDay(date) / PRAYER_CLOCK_BUCKET_MINUTES)
  );
}

/** Clockwise radians; midnight locked at the top. */
export function angleForBucket(index: number) {
  const minutes = (index + 0.5) * PRAYER_CLOCK_BUCKET_MINUTES;
  return (minutes / (24 * 60)) * Math.PI * 2 - Math.PI / 2;
}

/**
 * Intensity per 5-minute clock slot for the last 24 hours.
 * A longer prayer fills every slot it overlaps.
 */
export function buildIntensityRing(events: PrayerClockEvent[], now = new Date()) {
  const ring = new Float32Array(PRAYER_CLOCK_BUCKETS);
  const windowStart = now.getTime() - 24 * 60 * 60 * 1000;
  const windowEnd = now.getTime();
  const stepMs = PRAYER_CLOCK_BUCKET_MINUTES * 60_000;

  for (const event of events) {
    const start = new Date(event.startedAt).getTime();
    if (!Number.isFinite(start)) {
      continue;
    }
    const end = start + Math.max(1, Number(event.minutes) || 1) * 60_000;
    const from = Math.max(start, windowStart);
    const to = Math.min(end, windowEnd);
    if (to <= from) {
      continue;
    }
    for (let t = from; t < to; t += stepMs) {
      const idx = bucketIndexForDate(new Date(t));
      const sliceMinutes = Math.min(stepMs, to - t) / 60_000;
      ring[idx] += sliceMinutes;
    }
  }

  const smoothed = new Float32Array(PRAYER_CLOCK_BUCKETS);
  for (let i = 0; i < PRAYER_CLOCK_BUCKETS; i += 1) {
    const a = ring[(i + PRAYER_CLOCK_BUCKETS - 2) % PRAYER_CLOCK_BUCKETS];
    const b = ring[(i + PRAYER_CLOCK_BUCKETS - 1) % PRAYER_CLOCK_BUCKETS];
    const d = ring[(i + 1) % PRAYER_CLOCK_BUCKETS];
    const e = ring[(i + 2) % PRAYER_CLOCK_BUCKETS];
    smoothed[i] = a * 0.1 + b * 0.2 + ring[i] * 0.4 + d * 0.2 + e * 0.1;
  }
  return smoothed;
}
