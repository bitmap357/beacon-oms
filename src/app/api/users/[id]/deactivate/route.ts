/** POST deactivate. Soft-disable; they can no longer sign in. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireApiUser();
    requireApiPermission(current, "users.manage");
    const { id } = await context.params;
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: false } });
      await tx.facilityAssignment.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });
      await logAudit(tx, {
        userId: current.id,
        action: "user.deactivated",
        entityType: "User",
        entityId: id,
        ...meta,
      });
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
