/** GET/POST activities. Calendar visits POST here with type SITE_VISIT + startTime/endTime. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import { activitySchema } from "@/lib/validation";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const where = {
      facilityId: facilityId ? facilityId : { in: ids },
      ...(type ? { type: type as never } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };
    if (facilityId) await assertFacilityAccess(user, facilityId);
    const activities = await prisma.activity.findMany({
      where,
      include: {
        facility: { select: { name: true } },
        responsibleUser: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * 25,
      take: 25,
    });
    return json({ activities });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "activities.create");
    const body = activitySchema.parse(await request.json());
    await assertFacilityAccess(user, body.facilityId);
    const meta = requestMeta(request);
    const activity = await prisma.$transaction(async (tx) => {
      const next = await tx.activity.create({
        data: {
          facilityId: body.facilityId,
          type: body.type,
          date: new Date(body.date),
          startTime: body.startTime ? new Date(body.startTime) : null,
          endTime: body.endTime ? new Date(body.endTime) : null,
          responsibleUserId: body.responsibleUserId,
          description: body.description?.trim() || "",
          findings: body.findings,
          notes: body.notes,
          createdById: user.id,
          participants: body.participantIds?.length
            ? {
                create: body.participantIds.map((userId) => ({ userId })),
              }
            : undefined,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "activity.created",
        entityType: "Activity",
        entityId: next.id,
        newValue: { type: next.type, facilityId: next.facilityId },
        ...meta,
      });
      await refreshFacilityHealth(body.facilityId, tx);
      return next;
    });
    return json({ activity }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
