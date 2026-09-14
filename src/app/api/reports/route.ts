/** GET/POST reports. content is JSON-stringified for SQL Server. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import { reportSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";
import { toJsonString } from "@/lib/db-types";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const type = url.searchParams.get("type");
    if (facilityId) await assertFacilityAccess(user, facilityId);
    const reports = await prisma.report.findMany({
      where: {
        facilityId: facilityId ? facilityId : { in: ids },
        ...(type ? { type: type as never } : {}),
      },
      include: {
        facility: { select: { name: true } },
        author: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    });
    return json({ reports });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "reports.manage");
    const body = reportSchema.parse(await request.json());
    await assertFacilityAccess(user, body.facilityId);
    const meta = requestMeta(request);
    const report = await prisma.$transaction(async (tx) => {
      const next = await tx.report.create({
        data: {
          type: body.type,
          facilityId: body.facilityId,
          activityId: body.activityId,
          incidentId: body.incidentId,
          authorId: user.id,
          date: new Date(body.date),
          status: body.status ?? "DRAFT",
          content: toJsonString(body.content),
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "report.created",
        entityType: "Report",
        entityId: next.id,
        newValue: { type: next.type, status: next.status },
        ...meta,
      });
      return next;
    });
    if (report.status === "SUBMITTED") {
      const managers = await prisma.user.findMany({
        where: { role: { in: ["MANAGEMENT", "ADMIN"] }, isActive: true },
        select: { id: true },
      });
      await notifyUsers(
        managers.map((row) => row.id),
        {
          type: "REPORT_NEEDS_REVIEW",
          message: `Report submitted for review (${report.type})`,
          relatedType: "Report",
          relatedId: report.id,
        },
      );
    }
    return json({ report }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
