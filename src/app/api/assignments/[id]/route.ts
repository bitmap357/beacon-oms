/** PATCH assignment (lead flag, dates, active). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  HttpError,
  assertUnchanged,
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { assignmentPatchSchema } from "@/lib/validation";
import { assertFacilityAccess } from "@/lib/permissions";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "assignments.manage");
    const { id } = await context.params;
    const body = assignmentPatchSchema.parse(await request.json());
    const previous = await prisma.facilityAssignment.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    assertUnchanged(previous.updatedAt, body.updatedAt);
    const meta = requestMeta(request);

    const assignment = await prisma.$transaction(async (tx) => {
      if (body.isLead) {
        await tx.facilityAssignment.updateMany({
          where: {
            facilityId: previous.facilityId,
            assignmentType: previous.assignmentType,
            isLead: true,
            isActive: true,
            id: { not: id },
          },
          data: { isLead: false },
        });
      }
      // Collapse accidental duplicate active rows for the same person.
      if (previous.isActive && body.isActive !== false) {
        await tx.facilityAssignment.updateMany({
          where: {
            facilityId: previous.facilityId,
            userId: previous.userId,
            isActive: true,
            id: { not: id },
          },
          data: { isActive: false, endDate: new Date(), isLead: false },
        });
      }
      const next = await tx.facilityAssignment.update({
        where: { id },
        data: {
          isLead:
            body.isActive === false ? false : (body.isLead ?? previous.isLead),
          isActive: body.isActive ?? previous.isActive,
          endDate:
            body.isActive === false && previous.isActive ? new Date() : previous.endDate,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action:
          body.isActive === false
            ? "assignment.ended"
            : body.isLead
              ? "assignment.lead_changed"
              : "assignment.updated",
        entityType: "FacilityAssignment",
        entityId: id,
        previousValue: { isLead: previous.isLead, isActive: previous.isActive },
        newValue: { isLead: next.isLead, isActive: next.isActive },
        ...meta,
      });
      return next;
    });
    return json({ assignment });
  } catch (error) {
    return errorResponse(error);
  }
}
