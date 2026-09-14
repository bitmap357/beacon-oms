/** POST manual facility health override (or clear it). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  assertUnchanged,
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { statusOverrideSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "facilities.statusOverride");
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const body = statusOverrideSchema.parse(await request.json());
    const previous = await prisma.facility.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    assertUnchanged(previous.updatedAt, body.updatedAt);
    const meta = requestMeta(request);
    const facility = await prisma.$transaction(async (tx) => {
      const next = await tx.facility.update({
        where: { id },
        data: body.clear
          ? {
              statusOverride: false,
              statusOverrideReason: null,
              statusOverrideById: null,
              statusOverrideAt: null,
              status: previous.calculatedStatus,
              managementRequestedUrgentVisit: false,
            }
          : {
              statusOverride: true,
              status: body.status,
              statusOverrideReason: body.reason,
              statusOverrideById: user.id,
              statusOverrideAt: new Date(),
              managementRequestedUrgentVisit: body.status === "CRITICAL",
            },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "facility.status_overridden",
        entityType: "Facility",
        entityId: id,
        previousValue: { status: previous.status, override: previous.statusOverride },
        newValue: {
          status: next.status,
          override: next.statusOverride,
          reason: next.statusOverrideReason,
        },
        ...meta,
      });
      return next;
    });
    return json({ facility });
  } catch (error) {
    return errorResponse(error);
  }
}
