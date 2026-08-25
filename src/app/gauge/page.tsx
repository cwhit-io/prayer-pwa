import type { Metadata } from "next";
import { PrayerPulse } from "@/app/components/prayer-pulse";
import { getCampaignProgressSnapshot } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prayer Progress",
  description: "Live church-wide prayer campaign progress."
};

export default async function GaugePage() {
  const { settings, stats } = await getCampaignProgressSnapshot();

  return (
    <PrayerPulse
      currentMinutes={stats.totalMinutes}
      committedMinutes={stats.committedMinutes}
      goalMinutes={settings.goalMinutes}
      logPrayerUrl="/log"
      joinMovementUrl="/pledge"
      displayMode
    />
  );
}
