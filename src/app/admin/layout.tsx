import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "staff:access")) {
    redirect("/");
  }

  return (
    <div className="admin-area">
      <AdminNav role={user.role} />
      {children}
    </div>
  );
}
