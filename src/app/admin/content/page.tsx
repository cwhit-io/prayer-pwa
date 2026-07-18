import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sections = [
  {
    href: "/admin/prompts",
    title: "Campaign prompts",
    body: "Supplication prompts on the PRAY page. CSV download and full replace upload."
  },
  {
    href: "/admin/acts",
    title: "ACTS guide",
    body: "Adoration, Confession, and Thanksgiving prompts for the prayer guide."
  },
  {
    href: "/admin/categories",
    title: "Tags",
    body: "Shared tags for campaign prompts and ACTS guides (multi-select)."
  }
];

export default async function AdminContentHubPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (user.role !== "admin") {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Admin access needed</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Content</p>
          <h1 className="plc-title">Prayer content.</h1>
          <p className="plc-copy max-w-2xl">
            Everything people see when they PRAY—campaign prompts, ACTS guide steps, and categories.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="plc-panel block p-6 transition hover:border-yellow"
            >
              <h2 className="text-xl font-black uppercase text-white">{section.title}</h2>
              <p className="plc-copy mt-2">{section.body}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
