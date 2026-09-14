/** GET/PATCH one report (status, content). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { reportSchema } from "@/lib/validation";
import { toJsonString } from "@/lib/db-types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        facility: { include: { clientOrganization: true } },
        author: true,
        attachments: { where: { deletedAt: null } },
      },
    });
    if (!report) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, report.facilityId);
    return json({ report });
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
    requireApiPermission(user, "reports.manage");
    const { id } = await context.params;
    const previous = await prisma.report.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const body = reportSchema.partial().parse(await request.json());
    const meta = requestMeta(request);
    const report = await prisma.$transaction(async (tx) => {
      const next = await tx.report.update({
        where: { id },
        data: {
          status: body.status,
          content: body.content !== undefined ? toJsonString(body.content) : undefined,
          date: body.date ? new Date(body.date) : undefined,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "report.updated",
        entityType: "Report",
        entityId: id,
        previousValue: { status: previous.status },
        newValue: { status: next.status },
        ...meta,
      });
      return next;
    });
    return json({ report });
  } catch (error) {
    return errorResponse(error);
  }
}
