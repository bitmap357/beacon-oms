/** Server pages: require a signed-in user or redirect to /login. APIs use requireApiUser instead. */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadFreshSessionUser, type FreshSessionUser } from "@/lib/fresh-session";

export async function requireUser(options?: {
  allowPasswordReset?: boolean;
}): Promise<FreshSessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const fresh = await loadFreshSessionUser(session.user.id);
  if (!fresh) redirect("/login?error=inactive");
  if (fresh.mustResetPassword && !options?.allowPasswordReset) {
    redirect("/change-password");
  }
  return fresh;
}
