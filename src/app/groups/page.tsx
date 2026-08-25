import Link from "next/link";

export default function GroupsPage() {
  return (
    <main className="plc-page">
      <section className="plc-panel mx-auto max-w-2xl p-6">
        <p className="plc-eyebrow">Groups</p>
        <h1 className="mt-2 text-3xl font-black uppercase text-white">Your prayer groups are connected to your profile.</h1>
        <p className="plc-copy mt-3">
          Your household and church-family prayer lists appear on your profile after the church team connects your account.
          If you expected to see a group, contact the church office and ask them to check your church profile.
        </p>
        <Link href="/auth" className="plc-button mt-5">Go to my profile</Link>
      </section>
    </main>
  );
}
