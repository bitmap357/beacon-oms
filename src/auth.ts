/**
 * Auth.js credentials login. Wired at src/app/api/auth/[...nextauth]/route.ts.
 *
 * Session is a 30-minute JWT. Failed logins lock the account after 5 tries
 * (src/auth.ts lockDuration). Password hashing: src/lib/password.ts.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@/lib/db-types";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

const LOCK_WINDOWS_MS = [15, 30, 60].map((m) => m * 60 * 1000);

function lockDuration(failedCount: number) {
  const index = Math.min(
    Math.floor(Math.max(0, failedCount - 5) / 5),
    LOCK_WINDOWS_MS.length - 1,
  );
  return LOCK_WINDOWS_MS[index] ?? LOCK_WINDOWS_MS[0];
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const valid = await verifyPassword(
          user.passwordHash,
          parsed.data.password,
        );

        if (!valid) {
          const failedLoginCount = user.failedLoginCount + 1;
          const lockedUntil =
            failedLoginCount >= 5
              ? new Date(Date.now() + lockDuration(failedLoginCount))
              : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount, lockedUntil },
          });
          return null;
        }

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
            },
          });
          await logAudit(tx, {
            userId: user.id,
            action: "user.login",
            entityType: "User",
            entityId: user.id,
            newValue: { email: user.email },
          });
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustResetPassword: user.mustResetPassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.mustResetPassword = Boolean(
          (user as { mustResetPassword?: boolean }).mustResetPassword,
        );
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = token.role as UserRole;
        session.user.mustResetPassword = Boolean(token.mustResetPassword);
      }
      return session;
    },
  },
});
