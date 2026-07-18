import { redirect } from "next/navigation";

/** Groups UI is paused; family/friends lists live on the dashboard after PCO sync. */
export default function GroupsPage() {
  redirect("/auth");
}
