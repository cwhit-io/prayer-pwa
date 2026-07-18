import { redirect } from "next/navigation";

/** Dashboard lives on the profile page at /auth. */
export default function DashboardRedirectPage() {
  redirect("/auth");
}
