"use client";

import { useEffect, useRef } from "react";
import {
  buildIntensityRing,
  fortWayneMinutesOfDay,
  PRAYER_CLOCK_BUCKETS,
  PRAYER_CLOCK_BUCKET_MINUTES,
  type PrayerClockEvent
} from "@/lib/prayer-clock";

type PrayerDayClockProps = {
  events: PrayerClockEvent[];
  className?: string;
};

const TRAIL_STEPS = 480;
const DAY_MINUTES = 24 * 60;

type TrailSample = {
  x: number;
  y: number;
  width: number;
  alpha: number;
  head: number;
};

function point(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  };
}

function fract(n: number) {
  return n - Math.floor(n);
}

/** Stable 0..1 hash. Used only as a lookup table for interpolated value noise. */
function hash01(n: number) {
  return fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
}

function valueNoise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash01(i) * (1 - u) + hash01(i + 1) * u;
}

/**
 * Slow, incommensurate wander so the path is organic — never a repeating zigzag.
 * Wavelengths do not tile evenly around 24 hours.
 */
function organicOffset(minutes: number, activity: number) {
  const n =
    (valueNoise(minutes / 71.3 + 0.17) - 0.5) * 3.6 +
    (valueNoise(minutes / 157.1 + 2.08) - 0.5) * 2.2 +
    (valueNoise(minutes / 97.4 + 5.41) - 0.5) * 1.3;
  return n * (0.25 + activity * 0.85);
}

function intensityAt(ring: Float32Array, peak: number, minutesOfDay: number) {
  const pos = (minutesOfDay / PRAYER_CLOCK_BUCKET_MINUTES + PRAYER_CLOCK_BUCKETS) % PRAYER_CLOCK_BUCKETS;
  const i0 = Math.floor(pos) % PRAYER_CLOCK_BUCKETS;
  const i1 = (i0 + 1) % PRAYER_CLOCK_BUCKETS;
  const mix = pos - Math.floor(pos);
  const value = ring[i0] * (1 - mix) + ring[i1] * mix;
  const unit = Math.max(0, value) / peak;
  return Math.pow(unit, 0.72);
}

function goldStroke(alpha: number, head: number) {
  const g = Math.round(204 + 46 * head);
  const b = Math.round(20 + 150 * head * head);
  return `rgba(255, ${g}, ${b}, ${alpha})`;
}

export function PrayerDayClock({ events, className = "" }: PrayerDayClockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) {
      return;
    }

    const gfx = canvas.getContext("2d");
    if (!gfx) {
      return;
    }
    const surface = canvas;
    const host = wrap;
    const ctx = gfx;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = true;
    let cachedRing: Float32Array | null = null;
    let cachedAt = 0;
    let trailAt = 0;
    const trailLayer = document.createElement("canvas");
    const trailSurface = trailLayer.getContext("2d");
    if (!trailSurface) {
      return;
    }
    const trailCtx = trailSurface;

    function resize() {
      const size = Math.min(host.clientWidth, 520);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = size * dpr;
      surface.height = size * dpr;
      surface.style.width = `${size}px`;
      surface.style.height = `${size}px`;
      trailLayer.width = size * dpr;
      trailLayer.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      trailAt = 0;
    }

    function intensityRing(now: Date) {
      const t = now.getTime();
      if (!cachedRing || t - cachedAt > 12_000) {
        cachedRing = buildIntensityRing(eventsRef.current, now);
        cachedAt = t;
      }
      return cachedRing;
    }

    function trailSamples(now: Date, cx: number, cy: number, radius: number, unit: number) {
      const ring = intensityRing(now);
      let peak = 0.001;
      for (const value of ring) {
        if (value > peak) {
          peak = value;
        }
      }
      const nowMinutes = fortWayneMinutesOfDay(now);
      const nowAngle = (nowMinutes / DAY_MINUTES) * Math.PI * 2 - Math.PI / 2;
      const samples: TrailSample[] = [];

      for (let step = 0; step <= TRAIL_STEPS; step += 1) {
        const age = step / TRAIL_STEPS;
        const minutesOfDay = (nowMinutes - age * DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
        const activity = intensityAt(ring, peak, minutesOfDay);
        // Steeper brightness falloff than thickness so old peaks stay readable but dim.
        const cometWidth = Math.pow(1 - age, 1.45);
        const cometBright = Math.pow(1 - age, 2.15);
        const flare = Math.pow(1 - age, 6.8);
        const head = Math.pow(1 - age, 3.2);
        const width =
          (0.55 + flare * 17 + cometWidth * 1.1 + activity * (4.2 + 20 * cometWidth)) * unit;
        const alpha = Math.min(
          1,
          flare * 0.62 + 0.03 * cometBright + activity * (0.16 + 0.72 * cometBright)
        );
        const angle = nowAngle - age * Math.PI * 2;
        const r = radius + organicOffset(minutesOfDay, activity) * unit;
        const p = point(cx, cy, r, angle);
        samples.push({ x: p.x, y: p.y, width, alpha, head });
      }
      return samples;
    }

    function strokeTrail(
      target: CanvasRenderingContext2D,
      samples: TrailSample[],
      widthScale: number,
      alphaScale: number,
      blur: number
    ) {
      target.save();
      target.lineCap = "round";
      target.lineJoin = "round";
      if (blur > 0) {
        target.shadowColor = "rgba(255, 211, 0, 0.5)";
        target.shadowBlur = blur;
      }
      for (let i = samples.length - 1; i > 0; i -= 1) {
        const a = samples[i];
        const b = samples[i - 1];
        const width = ((a.width + b.width) / 2) * widthScale;
        const alpha = Math.min(1, ((a.alpha + b.alpha) / 2) * alphaScale);
        if (width < 0.2 || alpha < 0.012) {
          continue;
        }
        const head = Math.max(a.head, b.head);
        target.strokeStyle = goldStroke(alpha, head);
        target.lineWidth = width;
        target.beginPath();
        target.moveTo(a.x, a.y);
        target.lineTo(b.x, b.y);
        target.stroke();
      }
      target.restore();
    }

    function paintTrail(now: Date, size: number) {
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.36;
      const unit = size / 520;
      const samples = trailSamples(now, cx, cy, radius, unit);
      trailCtx.clearRect(0, 0, size, size);
      trailCtx.fillStyle = "#000";
      trailCtx.fillRect(0, 0, size, size);
      trailCtx.beginPath();
      trailCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      trailCtx.strokeStyle = "rgba(255, 255, 255, 0.10)";
      trailCtx.lineWidth = 1;
      trailCtx.stroke();
      strokeTrail(trailCtx, samples, 3.4, 0.16, 18 * unit);
      strokeTrail(trailCtx, samples, 1.7, 0.38, 8 * unit);
      strokeTrail(trailCtx, samples, 1, 1, 0);
    }

    function draw(nowMs: number) {
      const size = surface.clientWidth;
      if (size < 8) {
        return;
      }
      const now = new Date();
      if (nowMs - trailAt > 700 || trailAt === 0) {
        paintTrail(now, size);
        trailAt = nowMs || 1;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(trailLayer, 0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.36;
      const unit = size / 520;
      const nowMinutes = fortWayneMinutesOfDay(now);
      const nowAngle = (nowMinutes / DAY_MINUTES) * Math.PI * 2 - Math.PI / 2;
      const orb = point(cx, cy, radius, nowAngle);
      const breath = reduceMotion ? 1 : 1 + Math.sin(nowMs / 1800) * 0.025;
      const glowR = 34 * unit * breath;
      const orbGlow = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, glowR);
      orbGlow.addColorStop(0, "rgba(255, 248, 210, 0.95)");
      orbGlow.addColorStop(0.28, "rgba(255, 211, 0, 0.5)");
      orbGlow.addColorStop(1, "rgba(255, 211, 0, 0)");
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 6 * unit, 0, Math.PI * 2);
      ctx.fillStyle = "#fff6c8";
      ctx.fill();
    }

    function loop(ts: number) {
      if (!running) {
        return;
      }
      draw(ts);
      if (!reduceMotion) {
        frame = window.requestAnimationFrame(loop);
      }
    }

    resize();
    draw(0);
    if (!reduceMotion) {
      frame = window.requestAnimationFrame(loop);
    }
    const observer = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    observer.observe(host);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={`mx-auto aspect-square w-full max-w-[32rem] ${className}`}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        role="img"
        aria-label="A 24-hour clock of anonymous prayer on a black field. Midnight is at the top. The bright orb is now; the gold trail behind it is the last day of prayer."
      />
    </div>
  );
}
