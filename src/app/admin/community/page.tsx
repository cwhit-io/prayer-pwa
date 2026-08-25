import { redirect } from "next/navigation";

/** Community requests now live at the top-level Prayer requests page. */
export default function AdminCommunityHubPage() {
  redirect("/admin/requests");
}
