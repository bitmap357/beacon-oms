/** GET/POST follow-up actions. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import { actionSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const ownerId = url.searchParams.get("ownerId");
    const status = url.searchParams.get("status");
    const overdue = url.searchParams.get("overdue") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    if (facilityId) await assertFacilityAccess(user, facilityId);
    const actions = await prisma.action.findMany({
      where: {
        facilityId: facilityId ? facilityId : { in: ids },
        ...(ownerId ? { ownerId } : {}),
        ...(status ? { status: status as never } : {}),
        ...(overdue
          ? {
              dueDate: { lt: new Date() },
              status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
            }
          : {}),
      },
      include: {
        facility: { select: { name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * 25,
      take: 25,
    });
    return json({ actions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "actions.manage");
    const body = actionSchema.parse(await request.json());
    await assertFacilityAccess(user, body.facilityId);
    const meta = requestMeta(request);
    const action = await prisma.$transaction(async (tx) => {
      const next = await tx.action.create({
        data: {
          title: body.title,
          description: body.description,
          facilityId: body.facilityId,
          ownerId: body.ownerId,
          sourceType: body.sourceType,
          sourceId: body.sourceId,
          incidentId: body.incidentId,
          priority: body.priority,
          dueDate: new Date(body.dueDate),
          notes: body.notes,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "action.created",
        entityType: "Action",
        entityId: next.id,
        newValue: { title: next.title, dueDate: next.dueDate.toISOString() },
        ...meta,
      });
      await refreshFacilityHealth(body.facilityId, tx);
      return next;
    });
    await notifyUsers([action.ownerId], {
      type: "ACTION_ASSIGNED",
      message: `Action assigned: ${action.title}`,
      relatedType: "Action",
      relatedId: action.id,
    });
    return json({ action }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
