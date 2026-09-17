/**
 * Reload auth state from the DB so deactivated users, force-reset flags,
 * and role changes take effect before the JWT maxAge expires.
 */
import { prisma } from "@/lib/db";
import type { UserRole } from "@/lib/db-types";
import type { SessionUser } from "@/lib/permissions";

export type FreshSessionUser = SessionUser & {
  mustResetPassword: boolean;
};

export async function loadFreshSessionUser(
  userId: string,
): Promise<FreshSessionUser | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustResetPassword: true,
      lockedUntil: true,
    },
  });
  if (!row || !row.isActive) return null;
  if (row.lockedUntil && row.lockedUntil > new Date()) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    mustResetPassword: row.mustResetPassword,
  };
}
