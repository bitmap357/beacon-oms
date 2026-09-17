/** GET/POST users. Screen: /admin/users. Schema: userCreateSchema. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/email";
import { requireApiPermission, requireApiUser, errorResponse, json } from "@/lib/http";
import { userCreateSchema } from "@/lib/validation";
import { formatRole } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "users.read");
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "users.manage");
    const body = userCreateSchema.parse(await request.json());
    const meta = requestMeta(request);
    const created = await prisma.$transaction(async (tx) => {
      const next = await tx.user.create({
        data: {
          name: body.name,
          email: body.email,
          role: body.role,
          passwordHash: await hashPassword(body.password),
          mustResetPassword: true,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "user.created",
        entityType: "User",
        entityId: next.id,
        newValue: { name: next.name, email: next.email, role: next.role },
        ...meta,
      });
      return next;
    });

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    await sendEmail(
      created.email,
      "Your Beacon account",
      `<p>Hello ${created.name},</p>
       <p>An account was created for you on Beacon (${formatRole(created.role)}).</p>
       <p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> with this email and the temporary password your administrator shared, then set a new password.</p>
       <p>If you did not expect this message, contact your Beacon admin.</p>`,
    );

    return json({ user: { id: created.id, email: created.email } }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
