/** GET/POST QA records. A pass can move the linked incident to RESOLVED. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import { qaRecordSchema } from "@/lib/validation";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { notifyUsers } from "@/lib/notifications";
import { toJsonString } from "@/lib/db-types";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const facilityId = new URL(request.url).searchParams.get("facilityId");
    if (facilityId) await assertFacilityAccess(user, facilityId);
    const records = await prisma.qARecord.findMany({
      where: { facilityId: facilityId ? facilityId : { in: ids } },
      include: {
        facility: { select: { name: true } },
        qaUser: { select: { name: true } },
        relatedIncident: { select: { title: true, id: true } },
      },
      orderBy: { qaDate: "desc" },
      take: 50,
    });
    return json({ records });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "qa.manage");
    const body = qaRecordSchema.parse(await request.json());
    await assertFacilityAccess(user, body.facilityId);
    const meta = requestMeta(request);
    const record = await prisma.$transaction(async (tx) => {
      const next = await tx.qARecord.create({
        data: {
          facilityId: body.facilityId,
          relatedIncidentId: body.relatedIncidentId,
          qaUserId: user.id,
          qaDate: new Date(body.qaDate),
          itemsTested:
            body.itemsTested == null ? undefined : toJsonString(body.itemsTested),
          result: body.result,
          findings: body.findings,
          requiredCorrections: body.requiredCorrections,
          retestDate: body.retestDate ? new Date(body.retestDate) : null,
          finalVerification: Boolean(body.finalVerification),
        },
      });
      if (body.relatedIncidentId) {
        const incidentStatus =
          body.result === "PASSED" || body.result === "PASSED_WITH_ISSUES"
            ? "RESOLVED"
            : "REOPENED";
        const incident = await tx.incident.update({
          where: { id: body.relatedIncidentId },
          data: { status: incidentStatus },
        });
        await tx.incidentHistory.create({
          data: {
            incidentId: incident.id,
            changedById: user.id,
            fieldChanged: "status",
            oldValue: "AWAITING_QA",
            newValue: incidentStatus,
          },
        });
      }
      await logAudit(tx, {
        userId: user.id,
        action: "qa.created",
        entityType: "QARecord",
        entityId: next.id,
        newValue: { result: next.result, facilityId: next.facilityId },
        ...meta,
      });
      await refreshFacilityHealth(body.facilityId, tx);
      return next;
    });
    if (body.result === "FAILED" || body.result === "REQUIRES_RETEST") {
      const leads = await prisma.facilityAssignment.findMany({
        where: { facilityId: body.facilityId, isActive: true, isLead: true },
        select: { userId: true },
      });
      await notifyUsers(
        leads.map((row) => row.userId),
        {
          type: "QA_VERIFICATION_REQUIRED",
          message: "QA found issues that require follow-up",
          relatedType: "QARecord",
          relatedId: record.id,
        },
      );
    }
    return json({ record }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
