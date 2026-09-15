/** GET/PATCH incident. TRANSITIONS map in this file is the status machine — edit that to allow new flows. */
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
import { incidentPatchSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { INCIDENT_TRANSITIONS } from "@/lib/incident-status";
import { incidentLabel } from "@/lib/utils";
import type { IncidentStatus } from "@/lib/db-types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        facility: true,
        reporter: true,
        assignee: true,
        history: { orderBy: { changedAt: "asc" } },
        actions: true,
        qaRecords: true,
        attachments: { where: { deletedAt: null } },
      },
    });
    if (!incident) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, incident.facilityId);
    return json({ incident });
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
    requireApiPermission(user, "incidents.manage");
    const { id } = await context.params;
    const previous = await prisma.incident.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const body = incidentPatchSchema.parse(await request.json());
    assertUnchanged(previous.updatedAt, body.updatedAt);

    if (body.status && body.status !== previous.status) {
      const current = previous.status as IncidentStatus;
      if (!INCIDENT_TRANSITIONS[current].includes(body.status)) {
        throw new HttpError(400, "Invalid status transition");
      }
    }
    if (previous.priority === "CRITICAL" && body.status === "CLOSED") {
      assertUnchanged(previous.updatedAt, body.updatedAt ?? previous.updatedAt.toISOString());
    }

    const meta = requestMeta(request);
    const incident = await prisma.$transaction(async (tx) => {
      const next = await tx.incident.update({
        where: { id },
        data: {
          priority: body.priority,
          assigneeId: body.assigneeId,
          status: body.status,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          resolutionInfo: body.resolutionInfo,
          resolvedAt: body.status === "RESOLVED" ? new Date() : previous.resolvedAt,
          closedAt: body.status === "CLOSED" ? new Date() : previous.closedAt,
        },
      });
      const fields: Array<keyof typeof previous> = [
        "status",
        "assigneeId",
        "priority",
      ];
      for (const field of fields) {
        const oldValue = String(previous[field] ?? "");
        const newValue = String(next[field] ?? "");
        if (oldValue !== newValue) {
          await tx.incidentHistory.create({
            data: {
              incidentId: id,
              changedById: user.id,
              fieldChanged: field,
              oldValue,
              newValue,
            },
          });
        }
      }
      await logAudit(tx, {
        userId: user.id,
        action: "incident.updated",
        entityType: "Incident",
        entityId: id,
        previousValue: { status: previous.status, assigneeId: previous.assigneeId },
        newValue: { status: next.status, assigneeId: next.assigneeId },
        ...meta,
      });
      await refreshFacilityHealth(previous.facilityId, tx);
      return next;
    });

    if (body.assigneeId && body.assigneeId !== previous.assigneeId) {
      await notifyUsers([body.assigneeId], {
        type: "INCIDENT_ASSIGNED",
        message: `${incidentLabel(incident)} assigned`,
        relatedType: "Incident",
        relatedId: incident.id,
      });
    }
    if (body.status && body.status !== previous.status) {
      const recipients = [incident.assigneeId, incident.reporterId].filter(
        Boolean,
      ) as string[];
      await notifyUsers(recipients, {
        type:
          body.status === "REOPENED"
            ? "INCIDENT_REOPENED"
            : "INCIDENT_STATUS_CHANGED",
        message: `${incidentLabel(incident)} is now ${body.status.replaceAll("_", " ").toLowerCase()}`,
        relatedType: "Incident",
        relatedId: incident.id,
      });
    }
    return json({ incident });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "incidents.manage");
    const { id } = await context.params;
    const previous = await prisma.incident.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.incidentHistory.deleteMany({ where: { incidentId: id } });
      await tx.action.updateMany({ where: { incidentId: id }, data: { incidentId: null } });
      await tx.qARecord.updateMany({
        where: { relatedIncidentId: id },
        data: { relatedIncidentId: null },
      });
      await tx.report.updateMany({ where: { incidentId: id }, data: { incidentId: null } });
      await tx.attachment.updateMany({
        where: { incidentId: id },
        data: { incidentId: null, deletedAt: new Date(), deletedById: user.id },
      });
      await tx.incident.delete({ where: { id } });
      await logAudit(tx, {
        userId: user.id,
        action: "incident.deleted",
        entityType: "Incident",
        entityId: id,
        previousValue: { status: previous.status },
        ...meta,
      });
      await refreshFacilityHealth(previous.facilityId, tx);
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
