/** Server actions for login, logout, forgot/reset password. */
"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";
import { createResetToken, hashPassword, sha256 } from "@/lib/password";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = await rateLimit(`login:${ip}:${email.toLowerCase()}`, 10, 60);
  if (!limited.ok) {
    return { error: "Too many sign-in attempts. Try again in a minute." };
  }
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid credentials. If this continues, the account may be locked." };
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { ok: true };
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (user?.isActive) {
    const { token, hash } = createResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hash,
        passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your Beacon password",
      `<p>Hello ${user.name},</p><p>Reset your password using this link (valid for 30 minutes):</p><p><a href="${url}">${url}</a></p>`,
    );
    await logAudit(prisma, {
      userId: user.id,
      action: "user.password_reset_requested",
      entityType: "User",
      entityId: user.id,
    });
  }
  return { ok: true };
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid request" };
  }
  const tokenHash = sha256(parsed.data.token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
      isActive: true,
    },
  });
  if (!user) return { error: "This reset link is invalid or has expired." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        mustResetPassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        passwordUpdatedAt: new Date(),
      },
    });
    await logAudit(tx, {
      userId: user.id,
      action: "user.password_reset",
      entityType: "User",
      entityId: user.id,
    });
  });
  return { ok: true };
}
