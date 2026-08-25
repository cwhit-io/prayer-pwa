import { redirect } from "next/navigation";
import { getCurrentUser, hasCapability } from "@/lib/auth";

export default async function PrayerTeamPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "staff:access")) {
    redirect("/");
  }
  redirect("/admin");
}
