/** PATCH/DELETE a facility branch. Unlink incidents before delete (SQL Server NoAction). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  HttpError,
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { branchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; branchId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "facilities.manage");
    const { id, branchId } = await context.params;
    await assertFacilityAccess(user, id);
    const previous = await prisma.facilityBranch.findFirst({
      where: { id: branchId, facilityId: id },
    });
    if (!previous) return json({ error: "Not found" }, 404);
    const body = branchSchema.parse(await request.json());
    const meta = requestMeta(request);
    const branch = await prisma.$transaction(async (tx) => {
      const next = await tx.facilityBranch.update({
        where: { id: branchId },
        data: {
          name: body.name,
          location: body.location || null,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "branch.updated",
        entityType: "FacilityBranch",
        entityId: next.id,
        previousValue: { name: previous.name, location: previous.location },
        newValue: { name: next.name, location: next.location },
        ...meta,
      });
      return next;
    });
    return json({ branch });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return errorResponse(new HttpError(409, "A branch with that name already exists"));
    }
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; branchId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "facilities.manage");
    const { id, branchId } = await context.params;
    await assertFacilityAccess(user, id);
    const previous = await prisma.facilityBranch.findFirst({
      where: { id: branchId, facilityId: id },
    });
    if (!previous) return json({ error: "Not found" }, 404);
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.incident.updateMany({ where: { branchId }, data: { branchId: null } });
      await tx.facilityBranch.delete({ where: { id: branchId } });
      await logAudit(tx, {
        userId: user.id,
        action: "branch.deleted",
        entityType: "FacilityBranch",
        entityId: branchId,
        previousValue: { name: previous.name, facilityId: id },
        ...meta,
      });
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
