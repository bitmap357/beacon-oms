/** GET/POST incidents. List filters: facilityId, status, priority. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import { incidentSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    if (facilityId) await assertFacilityAccess(user, facilityId);
    const incidents = await prisma.incident.findMany({
      where: {
        facilityId: facilityId ? facilityId : { in: ids },
        ...(status ? { status: status as never } : {}),
        ...(priority ? { priority: priority as never } : {}),
      },
      include: {
        facility: { select: { name: true } },
        branch: { select: { name: true } },
        assignee: { select: { name: true } },
        reporter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
    });
    return json({ incidents });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "incidents.create");
    const body = incidentSchema.parse(await request.json());
    await assertFacilityAccess(user, body.facilityId);
    if (body.branchId) {
      const branch = await prisma.facilityBranch.findFirst({
        where: { id: body.branchId, facilityId: body.facilityId },
      });
      if (!branch) return json({ error: "Branch does not belong to this facility" }, 400);
    }
    const meta = requestMeta(request);
    const incident = await prisma.$transaction(async (tx) => {
      const next = await tx.incident.create({
        data: {
          title: body.title,
          facilityId: body.facilityId,
          branchId: body.branchId || null,
          description: body.description,
          reporterId: user.id,
          priority: body.priority,
          assigneeId: body.assigneeId || null,
          relatedActivityId: body.relatedActivityId || null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          status: body.assigneeId ? "ASSIGNED" : "NEW",
        },
      });
      await tx.incidentHistory.create({
        data: {
          incidentId: next.id,
          changedById: user.id,
          fieldChanged: "status",
          oldValue: null,
          newValue: next.status,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "incident.created",
        entityType: "Incident",
        entityId: next.id,
        newValue: { title: next.title, priority: next.priority },
        ...meta,
      });
      await refreshFacilityHealth(body.facilityId, tx);
      return next;
    });
    if (incident.assigneeId) {
      await notifyUsers([incident.assigneeId], {
        type: "INCIDENT_ASSIGNED",
        message: `Incident assigned: ${incident.title}`,
        relatedType: "Incident",
        relatedId: incident.id,
      });
    }
    return json({ incident }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
