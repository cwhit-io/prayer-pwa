import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  return (
    <div>
      {isAdmin ? <AdminNav /> : null}
      {children}
    </div>
  );
}
