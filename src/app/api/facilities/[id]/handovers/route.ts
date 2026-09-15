/** POST handover; builds summarySnapshot JSON of open work. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { handoverSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { OPEN_INCIDENT_STATUSES } from "@/lib/incident-status";
import { toJsonString } from "@/lib/db-types";

async function buildSnapshot(facilityId: string) {
  const [
    facility,
    assignments,
    incidents,
    actions,
    activities,
    qa,
  ] = await Promise.all([
    prisma.facility.findUnique({
      where: { id: facilityId },
      include: { clientOrganization: true, region: true },
    }),
    prisma.facilityAssignment.findMany({
      where: { facilityId, isActive: true },
      include: { user: { select: { name: true, role: true } } },
    }),
    prisma.incident.findMany({
      where: {
        facilityId,
        status: { in: [...OPEN_INCIDENT_STATUSES] },
      },
      select: { id: true, description: true, priority: true, status: true },
    }),
    prisma.action.findMany({
      where: {
        facilityId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
      },
      select: { id: true, title: true, dueDate: true, status: true },
    }),
    prisma.activity.findMany({
      where: { facilityId },
      orderBy: { date: "desc" },
      take: 8,
      select: { type: true, date: true, description: true },
    }),
    prisma.qARecord.findMany({
      where: { facilityId, result: { in: ["FAILED", "REQUIRES_RETEST"] } },
      select: { id: true, result: true, qaDate: true },
    }),
  ]);

  const lead = assignments.find((row) => row.isLead);
  return {
    facility: facility
      ? {
          name: facility.name,
          organization: facility.clientOrganization.name,
          region: facility.region?.name,
          status: facility.status,
        }
      : null,
    team: assignments.map((row) => ({
      name: row.user.name,
      type: row.assignmentType,
      isLead: row.isLead,
    })),
    lead: lead?.user.name ?? null,
    openIncidents: incidents,
    criticalIncidents: incidents.filter((row) => row.priority === "CRITICAL"),
    openActions: actions,
    overdueActions: actions.filter((row) => row.dueDate < new Date()),
    recentActivities: activities,
    pendingQa: qa,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const handovers = await prisma.handover.findMany({
      where: { facilityId: id },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        initiatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ handovers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "handovers.manage");
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const body = handoverSchema.parse(await request.json());
    const snapshot = await buildSnapshot(id);
    const meta = requestMeta(request);
    const handover = await prisma.$transaction(async (tx) => {
      const next = await tx.handover.create({
        data: {
          facilityId: id,
          fromUserId: body.fromUserId,
          toUserId: body.toUserId,
          initiatedById: user.id,
          summarySnapshot: toJsonString(snapshot),
          notes: body.notes,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "handover.created",
        entityType: "Handover",
        entityId: next.id,
        newValue: { facilityId: id, toUserId: body.toUserId },
        ...meta,
      });
      return next;
    });
    const recipients = [body.toUserId, body.fromUserId].filter(Boolean) as string[];
    await notifyUsers(recipients, {
      type: "HANDOVER_INITIATED",
      message: `A facility handover was initiated`,
      relatedType: "Handover",
      relatedId: handover.id,
    });
    return json({ handover }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
