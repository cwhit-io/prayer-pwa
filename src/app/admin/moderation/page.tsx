import { redirect } from "next/navigation";

/** Safety configuration now lives under Settings; the review queue lives under Prayer requests. */
export default function AdminModerationPage() {
  redirect("/admin/requests");
}
