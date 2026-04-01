import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "../../components/app-shell";
import { getServerSession } from "../../lib/auth-server";

export default async function ProductLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }

  return <AppShell session={session}>{children}</AppShell>;
}
