"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrayerMinutes, getPrayerPulseProgress } from "@/lib/prayer-pulse";

type PrayerPulseProps = {
  currentMinutes: number;
  committedMinutes?: number;
  goalMinutes?: number;
  logPrayerUrl: string;
  joinMovementUrl: string;
  displayMode?: boolean;
};

const ARC_CENTER_X = 500;
const ARC_CENTER_Y = 430;
const ARC_RADIUS = 390;
const milestones = [100_000, 250_000, 500_000, 750_000, 1_000_000];

function getArcPoint(progress: number, radius = ARC_RADIUS) {
  const angle = Math.PI * (1 - progress);

  return {
    x: ARC_CENTER_X + radius * Math.cos(angle),
    y: ARC_CENTER_Y - radius * Math.sin(angle)
  };
}

function getMilestoneLabel(value: number) {
  return value === 1_000_000 ? "1M" : `${value / 1_000}K`;
}

export function PrayerPulse({
  currentMinutes,
  committedMinutes = 0,
  goalMinutes = 1_000_000,
  logPrayerUrl,
  joinMovementUrl,
  displayMode = false
}: PrayerPulseProps) {
  const progress = getPrayerPulseProgress(currentMinutes, goalMinutes);
  const pledgeProgress = getPrayerPulseProgress(committedMinutes, goalMinutes);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [animatedPledgeProgress, setAnimatedPledgeProgress] = useState(0);
  const [animatedMinutes, setAnimatedMinutes] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);
  const filterId = useId().replace(/:/g, "");
  const activePoint = getArcPoint(animatedProgress);
  const arcPath = `M ${ARC_CENTER_X - ARC_RADIUS} ${ARC_CENTER_Y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${ARC_CENTER_X + ARC_RADIUS} ${ARC_CENTER_Y}`;
  const visibleMilestones = milestones.filter((milestone) => milestone <= progress.goalMinutes);

  useEffect(() => {
    const section = sectionRef.current;
    let animationFrame = 0;

    if (!section) {
      return;
    }

    const showFinalState = () => {
      setAnimatedProgress(progress.progress);
      setAnimatedPledgeProgress(pledgeProgress.progress);
      setAnimatedMinutes(progress.currentMinutes);
      hasAnimated.current = true;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showFinalState();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) {
          return;
        }

        hasAnimated.current = true;
        observer.disconnect();
        const startedAt = performance.now();
        const duration = 1_600;
        const animate = (now: number) => {
          const elapsed = Math.min(1, (now - startedAt) / duration);
          const eased = 1 - Math.pow(1 - elapsed, 3);
          setAnimatedProgress(progress.progress * eased);
          setAnimatedPledgeProgress(pledgeProgress.progress * eased);
          setAnimatedMinutes(Math.round(progress.currentMinutes * eased));

          if (elapsed < 1) {
            animationFrame = requestAnimationFrame(animate);
          }
        };

        animationFrame = requestAnimationFrame(animate);

      },
      { threshold: 0.2 }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [pledgeProgress.progress, progress.currentMinutes, progress.progress]);

  return (
    <section
      ref={sectionRef}
      className={`prayer-pulse${displayMode ? " prayer-pulse-display" : ""}`}
      aria-labelledby="prayer-pulse-title"
    >
      <p className="sr-only" role="status">
        {progress.accessibleSummary} {formatPrayerMinutes(pledgeProgress.currentMinutes)} minutes have been committed.
      </p>
      <div className="prayer-pulse-shell">
        <h2 id="prayer-pulse-title" className="prayer-pulse-headline">
          <span>One church. One year.</span> <strong>{formatPrayerMinutes(goalMinutes)} minutes.</strong>
        </h2>

        <div
          className="prayer-pulse-gauge"
          role="progressbar"
          aria-label={progress.accessibleSummary}
          aria-valuemin={0}
          aria-valuemax={progress.goalMinutes}
          aria-valuenow={Math.min(progress.currentMinutes, progress.goalMinutes)}
        >
          <svg className="prayer-pulse-svg" viewBox="0 0 1000 500" aria-hidden="true">
            <defs>
              <filter id={filterId} x="-8%" y="-12%" width="116%" height="124%">
                <feTurbulence type="fractalNoise" baseFrequency="0.015 0.09" numOctaves="2" seed="17" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>

            <g className="prayer-pulse-rings">
              <path d="M 35 430 A 465 465 0 0 1 965 430" pathLength="100" />
              <path d="M 65 430 A 435 435 0 0 1 935 430" pathLength="100" />
            </g>

            <path className="prayer-pulse-track" d={arcPath} pathLength="100" />
            <path
              className="prayer-pulse-pledged"
              d={arcPath}
              pathLength="100"
              style={{ strokeDashoffset: 100 - animatedPledgeProgress * 100 }}
            />
            <path
              className="prayer-pulse-active"
              d={arcPath}
              pathLength="100"
              style={{ strokeDashoffset: 100 - animatedProgress * 100 }}
            />
            <path
              className="prayer-pulse-brush"
              d={arcPath}
              pathLength="100"
              filter={`url(#${filterId})`}
              style={{ strokeDashoffset: 100 - animatedProgress * 100 }}
            />

            {visibleMilestones.map((milestone, index) => {
              const milestoneProgress = Math.min(1, milestone / progress.goalMinutes);
              const inner = getArcPoint(milestoneProgress, ARC_RADIUS - 38);
              const outer = getArcPoint(milestoneProgress, ARC_RADIUS + 18);
              const label = getArcPoint(milestoneProgress, ARC_RADIUS + 58);

              return (
                <g
                  key={milestone}
                  className={index > 0 && index < visibleMilestones.length - 1 ? "prayer-pulse-milestone prayer-pulse-milestone-intermediate" : "prayer-pulse-milestone"}
                >
                  <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
                  <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                    {getMilestoneLabel(milestone)}
                  </text>
                </g>
              );
            })}

            <g className="prayer-pulse-crown" transform={`translate(${activePoint.x} ${activePoint.y - 43}) rotate(-7)`}>
              <path d="M -28 14 L -24 -20 L -5 0 L 3 -28 L 17 -2 L 31 -22 L 27 15 Z" />
              <path d="M -29 21 Q 0 15 29 21" />
              <circle cx="-24" cy="-21" r="3" />
              <circle cx="3" cy="-29" r="3" />
              <circle cx="31" cy="-23" r="3" />
            </g>
          </svg>

          <div className="prayer-pulse-content">
            <strong className="prayer-pulse-total" aria-hidden="true">
              {formatPrayerMinutes(animatedMinutes)}
            </strong>
            <span className="prayer-pulse-label">Minutes prayed</span>
            <span className="prayer-pulse-rule" aria-hidden="true" />
            <span className="prayer-pulse-progress-label">
              <strong>{progress.formattedPercentage}%</strong> of {progress.formattedGoalMinutes}
            </span>
            <span className="prayer-pulse-pledge-label">
              <span aria-hidden="true" />
              {formatPrayerMinutes(pledgeProgress.currentMinutes)} minutes committed
            </span>
            <p>Every prayer matters. Together, we’re seeking God.</p>
          </div>
        </div>

        {!displayMode ? (
          <div className="prayer-pulse-actions">
             <Link href={logPrayerUrl} className="prayer-pulse-button prayer-pulse-button-primary">
               Start praying
             </Link>
             <Link href={joinMovementUrl} className="prayer-pulse-button prayer-pulse-button-secondary">
                Make a campaign pledge
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
