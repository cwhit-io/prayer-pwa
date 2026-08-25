import { PrayerPulse } from "@/app/components/prayer-pulse";

export function PrayerPulseExample() {
  return (
    <PrayerPulse
      currentMinutes={427315}
      committedMinutes={612000}
      logPrayerUrl="/log"
      joinMovementUrl="/pledge"
    />
  );
}
