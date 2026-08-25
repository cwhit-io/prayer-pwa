import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrayerFriendSlots } from "@/lib/prayer-friends";
import { getPrayerPeopleForUser } from "@/lib/pco-people";
import { PeopleFocusPicker } from "./people-focus-picker";

export const dynamic = "force-dynamic";

export default async function PeopleToPrayForPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?next=/people");
  }

  const [friendSlots, household, churchFamily] = await Promise.all([
    getPrayerFriendSlots(user.id),
    getPrayerPeopleForUser(user.id, "family"),
    getPrayerPeopleForUser(user.id, "friends")
  ]);

  return (
    <main className="plc-page">
      <div className="plc-shell max-w-3xl space-y-7">
        <header className="space-y-3">
          <p className="plc-eyebrow">Personal prayer focus</p>
          <h1 className="plc-title">People to pray for</h1>
          <p className="plc-copy max-w-2xl">
            Choose one of your four friends, someone in your household, or someone in your church family. Their name will be carried into the prayer timer.
          </p>
        </header>

        <PeopleFocusPicker
          friends={friendSlots.filter((slot) => slot.name).map((slot) => ({ id: `friend-${slot.slot}`, name: slot.name }))}
          household={household.map((person) => ({ id: person.id, name: person.name, detail: person.sourceGroupName }))}
          churchFamily={churchFamily.map((person) => ({ id: person.id, name: person.name, detail: person.sourceGroupName }))}
          churchProfileConnected={Boolean(user.planningCenterPersonId)}
        />

        <div className="flex flex-wrap gap-3">
          <Link href="/auth#people" className="plc-button-secondary">Manage my four friends</Link>
          <Link href="/log" className="plc-button-secondary">Start timer without a focus</Link>
        </div>
      </div>
    </main>
  );
}
