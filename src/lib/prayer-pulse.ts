const DEFAULT_GOAL_MINUTES = 1_000_000;

const countFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

export type PrayerPulseProgress = {
  currentMinutes: number;
  goalMinutes: number;
  progress: number;
  percentage: number;
  formattedCurrentMinutes: string;
  formattedGoalMinutes: string;
  formattedPercentage: string;
  accessibleSummary: string;
};

export function getPrayerPulseProgress(
  currentMinutes: number,
  goalMinutes = DEFAULT_GOAL_MINUTES
): PrayerPulseProgress {
  const safeCurrentMinutes = Number.isFinite(currentMinutes) ? Math.max(0, currentMinutes) : 0;
  const safeGoalMinutes = Number.isFinite(goalMinutes) && goalMinutes > 0 ? goalMinutes : DEFAULT_GOAL_MINUTES;
  const progress = Math.min(1, Math.max(0, safeCurrentMinutes / safeGoalMinutes));
  const percentage = progress * 100;
  const formattedCurrentMinutes = countFormatter.format(safeCurrentMinutes);
  const formattedGoalMinutes = countFormatter.format(safeGoalMinutes);
  const formattedPercentage = percentFormatter.format(percentage);

  return {
    currentMinutes: safeCurrentMinutes,
    goalMinutes: safeGoalMinutes,
    progress,
    percentage,
    formattedCurrentMinutes,
    formattedGoalMinutes,
    formattedPercentage,
    accessibleSummary: `${formattedCurrentMinutes} of ${formattedGoalMinutes} prayer minutes completed, ${formattedPercentage} percent.`
  };
}

export function formatPrayerMinutes(value: number) {
  return countFormatter.format(Math.max(0, value));
}
