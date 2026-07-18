import { redirect } from "next/navigation";

/** Prayer-team queue UI is paused; admins moderate via /admin/requests. */
export default function PrayerTeamPage() {
  redirect("/admin/requests");
}
