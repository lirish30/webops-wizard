import { cookies } from "next/headers";

import { webEnv } from "./env";
import type { AuthSession } from "./auth-types";

export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${webEnv.NEXT_PUBLIC_API_URL}/auth/session?allowRefresh=false`,
    {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {}
    }
  );

  if (!response.ok) {
    return null;
  }

  const parsed = (await response.json()) as { session: AuthSession };
  return parsed.session;
}
