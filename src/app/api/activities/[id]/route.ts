/** PATCH a logged activity/visit. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { activitySchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        facility: true,
        responsibleUser: true,
        participants: { include: { user: true } },
        attachments: { where: { deletedAt: null } },
      },
    });
    if (!activity) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, activity.facilityId);
    return json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "activities.create");
    const { id } = await context.params;
    const previous = await prisma.activity.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const body = activitySchema.partial().parse(await request.json());
    const meta = requestMeta(request);
    const activity = await prisma.$transaction(async (tx) => {
      const next = await tx.activity.update({
        where: { id },
        data: {
          type: body.type,
          date: body.date ? new Date(body.date) : undefined,
          description: body.description,
          findings: body.findings,
          notes: body.notes,
          responsibleUserId: body.responsibleUserId,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "activity.updated",
        entityType: "Activity",
        entityId: id,
        previousValue: { description: previous.description },
        newValue: { description: next.description },
        ...meta,
      });
      return next;
    });
    return json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
