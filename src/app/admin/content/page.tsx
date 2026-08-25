import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasCapability } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sections = [
  {
    href: "/admin/prompts",
    title: "Prayer prompts",
    body: "Manage the prompts people see when they need something to pray about."
  },
  {
    href: "/admin/acts",
    title: "ACTS guide",
    body: "Manage the Adoration, Confession, Thanksgiving, and Supplication steps in the optional prayer guide."
  },
  {
    href: "/admin/categories",
    title: "Topics",
    body: "Create topics that help people and staff organize prayer prompts."
  }
];

export default async function AdminContentHubPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "prayer-content:manage")) {
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
          <p className="plc-eyebrow">Staff admin · Prayer content</p>
          <h1 className="plc-title">Manage what people see when they pray.</h1>
          <p className="plc-copy max-w-2xl">
            Choose one of the tools below. Start with Prayer prompts for the main content, or use the ACTS guide for the
            four prayer steps.
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
