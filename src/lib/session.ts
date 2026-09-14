/** Server pages: require a signed-in user or redirect to /login. APIs use requireApiUser instead. */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { SessionUser } from "@/lib/permissions";

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user as SessionUser;
}
