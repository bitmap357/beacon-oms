/** POST handover; transfers Lead PM/QA and saves summarySnapshot of open work. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { handoverSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { OPEN_INCIDENT_STATUS_QUERY, OPEN_ACTION_STATUSES } from "@/lib/incident-status";
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
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
      },
      select: { id: true, description: true, priority: true, status: true },
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

  const lead = assignments.find((row) => row.isLead && row.assignmentType === "PM_QA");
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

    const fromUserId = leadRow.userId;
    const snapshot = await buildSnapshot(id);
    const meta = requestMeta(request);
    const handover = await prisma.$transaction(async (tx) => {
      // Demote current lead; they remain on the team as a member.
      await tx.facilityAssignment.update({
        where: { id: leadRow.id },
        data: { isLead: false },
      });

      // Upsert recipient as the sole active Lead PM/QA row for this facility.
      const activeForTo = await tx.facilityAssignment.findMany({
        where: { facilityId: id, userId: body.toUserId!, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      const primary = activeForTo[0];
      if (activeForTo.length > 1) {
        await tx.facilityAssignment.updateMany({
          where: { id: { in: activeForTo.slice(1).map((row) => row.id) } },
          data: { isActive: false, endDate: new Date(), isLead: false },
        });
      }
      if (primary) {
        await tx.facilityAssignment.update({
          where: { id: primary.id },
          data: { assignmentType: "PM_QA", isLead: true },
        });
      } else {
        const inactive = await tx.facilityAssignment.findFirst({
          where: { facilityId: id, userId: body.toUserId!, isActive: false },
          orderBy: { updatedAt: "desc" },
        });
        if (inactive) {
          await tx.facilityAssignment.update({
            where: { id: inactive.id },
            data: {
              assignmentType: "PM_QA",
              isLead: true,
              isActive: true,
              startDate: new Date(),
              endDate: null,
            },
          });
        } else {
          await tx.facilityAssignment.create({
            data: {
              facilityId: id,
              userId: body.toUserId!,
              assignmentType: "PM_QA",
              isLead: true,
            },
          });
        }
      }

      // Ensure no other PM/QA lead remains.
      await tx.facilityAssignment.updateMany({
        where: {
          facilityId: id,
          assignmentType: "PM_QA",
          isLead: true,
          isActive: true,
          userId: { not: body.toUserId! },
        },
        data: { isLead: false },
      });

      const next = await tx.handover.create({
        data: {
          facilityId: id,
          fromUserId,
          toUserId: body.toUserId!,
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
        newValue: {
          facilityId: id,
          fromUserId,
          toUserId: body.toUserId,
          leadTransferred: true,
        },
        ...meta,
      });
      return next;
    });
    const recipients = [body.toUserId, fromUserId].filter(Boolean) as string[];
    await notifyUsers(recipients, {
      type: "HANDOVER_INITIATED",
      message: `Lead PM/QA handover completed for this facility`,
      relatedType: "Handover",
      relatedId: handover.id,
    });
    return json({ handover }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
