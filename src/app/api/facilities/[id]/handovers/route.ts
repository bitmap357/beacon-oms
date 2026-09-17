/**
 * Handover create = PENDING request (no lead transfer yet).
 * Admin approve/reject via /api/handovers/[id]/review.
 */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { handoverSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { OPEN_INCIDENT_STATUS_QUERY, OPEN_ACTION_STATUSES } from "@/lib/incident-status";
import { toJsonString } from "@/lib/db-types";

async function buildSnapshot(facilityId: string) {
  const [facility, assignments, incidents, actions, activities, qa] = await Promise.all([
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
        archivedAt: null,
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
      },
      select: {
        id: true,
        incidentNumber: true,
        description: true,
        priority: true,
        status: true,
      },
    }),
    prisma.action.findMany({
      where: {
        facilityId,
        status: { in: [...OPEN_ACTION_STATUSES] },
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

  return {
    facility: facility
      ? {
          name: facility.name,
          organization: facility.clientOrganization.name,
          region: facility.region?.name,
          status: facility.status,
        }
      : null,
    // Team roster without calling out the lead (product: remove lead from snapshot).
    team: assignments.map((row) => ({
      name: row.user.name,
      type: row.assignmentType,
    })),
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
        reviewedBy: { select: { name: true } },
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
    if (!body.toUserId) throw new HttpError(400, "Choose who receives the handover");

    const toUser = await prisma.user.findUnique({ where: { id: body.toUserId } });
    if (!toUser || !toUser.isActive) throw new HttpError(400, "Recipient not found");
    if (toUser.role !== "PM_QA") {
      throw new HttpError(400, "Lead PM/QA handover must go to a PM/QA user");
    }

    const leadRow = await prisma.facilityAssignment.findFirst({
      where: { facilityId: id, isActive: true, assignmentType: "PM_QA", isLead: true },
    });
    if (!leadRow) throw new HttpError(400, "Assign a Lead PM/QA before starting a handover");
    if (leadRow.userId === body.toUserId) {
      throw new HttpError(400, "Recipient is already the Lead PM/QA");
    }

    const pending = await prisma.handover.findFirst({
      where: { facilityId: id, status: "PENDING" },
    });
    if (pending) {
      throw new HttpError(400, "A pending handover already exists for this facility");
    }

    const fromUserId = leadRow.userId;
    const snapshot = await buildSnapshot(id);
    const meta = requestMeta(request);
    const handover = await prisma.$transaction(async (tx) => {
      const next = await tx.handover.create({
        data: {
          facilityId: id,
          fromUserId,
          toUserId: body.toUserId!,
          initiatedById: user.id,
          status: "PENDING",
          summarySnapshot: toJsonString(snapshot),
          notes: body.notes,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "handover.requested",
        entityType: "Handover",
        entityId: next.id,
        newValue: {
          facilityId: id,
          fromUserId,
          toUserId: body.toUserId,
          status: "PENDING",
        },
        ...meta,
      });
      return next;
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    await notifyUsers(
      [...admins.map((row) => row.id), body.toUserId, fromUserId].filter(Boolean) as string[],
      {
        type: "HANDOVER_PENDING",
        message: `Lead PM/QA handover requested — awaiting admin approval`,
        relatedType: "Handover",
        relatedId: handover.id,
      },
    );
    return json({ handover }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
