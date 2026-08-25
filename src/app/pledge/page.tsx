import Link from "next/link";
import { redirect } from "next/navigation";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import { getUserCampaignOverview } from "@/lib/campaign-model";
import { getLatestPledge } from "@/lib/pledges";
import { PledgeForm } from "@/app/auth/pledge-form";

export const dynamic = "force-dynamic";

/**
 * Optional campaign prayer pledge setup.
 * Members who already pledged are sent to their profile (update lives on /auth).
 */
export default async function PledgePage({
  searchParams
}: {
  searchParams?: Promise<{
    required?: string;
    error?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    redirect("/auth");
  }

  const [pledge, campaign] = await Promise.all([
    getLatestPledge(user.id),
    getUserCampaignOverview(user.id)
  ]);
  if (pledge || campaign?.campaignEnded) {
    redirect("/auth");
  }

  return (
    <main className="plc-page">
      <div className="plc-shell grid min-h-[72vh] place-items-center">
        <section className="plc-panel w-full max-w-2xl p-8">
            <p className="plc-eyebrow">Campaign prayer pledge</p>
          <h1 className="brush-small mt-3 text-5xl uppercase leading-none text-white">
              {`Make a prayer pledge, ${user.name.split(" ")[0] || user.name}.`}
          </h1>
          <p className="plc-copy mt-4">
              Choose a weekly pace for your campaign commitment. The app converts it into a {campaign?.installmentCount ?? 52}-week pledge, while prayer credited to the campaign counts whether or not you pledge.
          </p>

          <div className="mt-4">
            <FormBanner error={params?.error} />
          </div>

          <div id="pledge" className="mt-8">
            <PledgeForm defaultMinutesPerWeek={70} isUpdate={false} installmentCount={campaign?.installmentCount ?? 52} />
          </div>

           <p className="mt-8 text-center text-base text-white/75">
            Prefer to look around first?{" "}
             <Link href="/log" className="font-black uppercase text-yellow">
               Start praying without a goal
            </Link>
            {" · "}
            <Link href="/auth" className="font-black uppercase text-yellow">
              Profile
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
