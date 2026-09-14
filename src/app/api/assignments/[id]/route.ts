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
import { assertFacilityAccess } from "@/lib/permissions";
import { z } from "zod";

const patchSchema = z.object({
  isLead: z.boolean().optional(),
  isActive: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "assignments.manage");
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const previous = await prisma.facilityAssignment.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    assertUnchanged(previous.updatedAt, body.updatedAt);
    const meta = requestMeta(request);

    const assignment = await prisma.$transaction(async (tx) => {
      if (body.isLead) {
        const existingLead = await tx.facilityAssignment.findFirst({
          where: {
            facilityId: previous.facilityId,
            isLead: true,
            isActive: true,
            id: { not: id },
          },
        });
        if (existingLead) {
          throw new HttpError(409, "This facility already has an active lead PM/QA");
        }
        if (previous.assignmentType !== "PM_QA") {
          throw new HttpError(400, "Lead must be a PM/QA assignment");
        }
      }
      const next = await tx.facilityAssignment.update({
        where: { id },
        data: {
          isLead: body.isLead ?? previous.isLead,
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
