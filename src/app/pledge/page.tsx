import { redirect } from "next/navigation";

/** Pledge create/edit lives on the profile dashboard. */
export default function PledgeRedirectPage() {
  redirect("/auth#pledge");
}
