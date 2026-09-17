/** POST clear deletion flag, or admin-confirm archive. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  HttpError,
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["clear_flag", "confirm_archive"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "incidents.manage");
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const previous = await prisma.incident.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const meta = requestMeta(request);

    if (body.action === "clear_flag") {
      if (user.role !== "ADMIN" && user.role !== "MANAGEMENT") {
        throw new HttpError(403, "Only admins can clear a deletion flag");
      }
      const incident = await prisma.$transaction(async (tx) => {
        const next = await tx.incident.update({
          where: { id },
          data: { deletionRequestedAt: null, deletionRequestedById: null },
        });
        await tx.incidentHistory.create({
          data: {
            incidentId: id,
            changedById: user.id,
            fieldChanged: "deletionRequestedAt",
            oldValue: previous.deletionRequestedAt?.toISOString() ?? "",
            newValue: "",
          },
        });
        await logAudit(tx, {
          userId: user.id,
          action: "incident.deletion_flag_cleared",
          entityType: "Incident",
          entityId: id,
          ...meta,
        });
        return next;
      });
      return json({ ok: true, incident });
    }

    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can confirm archive");
    }
    if (previous.archivedAt) return json({ ok: true, incident: previous });
    const incident = await prisma.$transaction(async (tx) => {
      const next = await tx.incident.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          deletionRequestedAt: previous.deletionRequestedAt ?? new Date(),
          deletionRequestedById: previous.deletionRequestedById ?? user.id,
        },
      });
      await tx.incidentHistory.create({
        data: {
          incidentId: id,
          changedById: user.id,
          fieldChanged: "archivedAt",
          oldValue: "",
          newValue: next.archivedAt?.toISOString() ?? "archived",
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "incident.archived",
        entityType: "Incident",
        entityId: id,
        ...meta,
      });
      await refreshFacilityHealth(previous.facilityId, tx);
      return next;
    });
    return json({ ok: true, incident });
  } catch (error) {
    return errorResponse(error);
  }
}
