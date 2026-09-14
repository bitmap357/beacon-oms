/** GET/PATCH one QA record. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { qaRecordSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const record = await prisma.qARecord.findUnique({
      where: { id },
      include: {
        facility: true,
        qaUser: true,
        relatedIncident: true,
        attachments: { where: { deletedAt: null } },
      },
    });
    if (!record) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, record.facilityId);
    return json({ record });
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
    requireApiPermission(user, "qa.manage");
    const { id } = await context.params;
    const previous = await prisma.qARecord.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const body = qaRecordSchema.partial().parse(await request.json());
    const meta = requestMeta(request);
    const record = await prisma.$transaction(async (tx) => {
      const next = await tx.qARecord.update({
        where: { id },
        data: {
          result: body.result,
          findings: body.findings,
          requiredCorrections: body.requiredCorrections,
          finalVerification: body.finalVerification,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "qa.updated",
        entityType: "QARecord",
        entityId: id,
        previousValue: { result: previous.result },
        newValue: { result: next.result },
        ...meta,
      });
      return next;
    });
    return json({ record });
  } catch (error) {
    return errorResponse(error);
  }
}
