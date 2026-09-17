/** POST change password for a logged-in user with mustResetPassword (or voluntary). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { passwordSchema } from "@/lib/validation";
import { z } from "zod";

const bodySchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1),
  })
  .refine((row) => row.password === row.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export async function POST(request: Request) {
  try {
    const user = await requireApiUser({ allowPasswordReset: true });
    const body = bodySchema.parse(await request.json());
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(body.password),
          mustResetPassword: false,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          passwordUpdatedAt: new Date(),
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "user.password_changed",
        entityType: "User",
        entityId: user.id,
        ...meta,
      });
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
