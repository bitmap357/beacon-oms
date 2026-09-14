/** POST force password reset (mustResetPassword + email). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { createResetToken, hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/email";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireApiUser();
    requireApiPermission(current, "users.forceReset");
    const { id } = await context.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return json({ error: "Not found" }, 404);
    const { token, hash } = createResetToken();
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          mustResetPassword: true,
          passwordResetTokenHash: hash,
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          passwordHash: await hashPassword(`Tmp!${crypto.randomUUID().slice(0, 10)}`),
        },
      });
      await logAudit(tx, {
        userId: current.id,
        action: "user.force_reset",
        entityType: "User",
        entityId: id,
        ...meta,
      });
    });
    const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Your Beacon password must be reset",
      `<p>An administrator required a password reset.</p><p><a href="${url}">${url}</a></p>`,
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
