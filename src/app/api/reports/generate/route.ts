/** POST operational report from incidents+actions in a date range. Then the UI opens /reports/[id]. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { generateReportSchema } from "@/lib/validation";
import { buildOperationalReport } from "@/lib/operational-report";
import { toJsonString } from "@/lib/db-types";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "reports.manage");
    const body = generateReportSchema.parse(await request.json());
    await assertFacilityAccess(user, body.facilityId);
    const from = new Date(body.from);
    const to = new Date(body.to);
    to.setHours(23, 59, 59, 999);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return json({ error: "Provide a valid date range" }, 400);
    }
    const built = await buildOperationalReport({
      facilityId: body.facilityId,
      branchId: body.branchId,
      from,
      to,
    });
    if (!built) return json({ error: "Facility not found" }, 404);

    const meta = requestMeta(request);
    const report = await prisma.$transaction(async (tx) => {
      const next = await tx.report.create({
        data: {
          type: "OPERATIONAL",
          facilityId: body.facilityId,
          authorId: user.id,
          date: to,
          periodStart: from,
          periodEnd: to,
          status: "DRAFT",
          content: toJsonString(built.content),
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "report.generated",
        entityType: "Report",
        entityId: next.id,
        newValue: {
          type: "OPERATIONAL",
          from: from.toISOString(),
          to: to.toISOString(),
          incidentCount: built.content.incidentCount,
        },
        ...meta,
      });
      return next;
    });
    return json({ report }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
