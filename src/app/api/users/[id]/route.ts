/** PATCH a user (name, role, active). Does not set passwords — use force-reset. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import {
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { userUpdateSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireApiUser();
    const { id } = await context.params;
    if (current.id !== id) requireApiPermission(current, "users.read");
    const user = await prisma.user.findUnique({
      where: { id },
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
    if (!user) return json({ error: "Not found" }, 404);
    return json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireApiUser();
    const { id } = await context.params;
    const body = userUpdateSchema.parse(await request.json());
    if (current.id !== id) requireApiPermission(current, "users.manage");
    else {
      delete body.role;
      delete body.isActive;
    }
    const previous = await prisma.user.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    const meta = requestMeta(request);
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.user.update({ where: { id }, data: body });
      await logAudit(tx, {
        userId: current.id,
        action: "user.updated",
        entityType: "User",
        entityId: id,
        previousValue: {
          name: previous.name,
          role: previous.role,
          isActive: previous.isActive,
        },
        newValue: { name: next.name, role: next.role, isActive: next.isActive },
        ...meta,
      });
      return next;
    });
    return json({ user: { id: updated.id } });
  } catch (error) {
    return errorResponse(error);
  }
}
