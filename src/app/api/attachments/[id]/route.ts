/** GET signed URL or DELETE (soft) an attachment. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { deleteObject, signedGetUrl } from "@/lib/storage";

async function facilityIdFor(attachment: {
  activityId: string | null;
  incidentId: string | null;
  reportId: string | null;
  qaRecordId: string | null;
}) {
  if (attachment.activityId) {
    const row = await prisma.activity.findUnique({
      where: { id: attachment.activityId },
    });
    return row?.facilityId;
  }
  if (attachment.incidentId) {
    const row = await prisma.incident.findUnique({
      where: { id: attachment.incidentId },
    });
    return row?.facilityId;
  }
  if (attachment.reportId) {
    const row = await prisma.report.findUnique({
      where: { id: attachment.reportId },
    });
    return row?.facilityId;
  }
  if (attachment.qaRecordId) {
    const row = await prisma.qARecord.findUnique({
      where: { id: attachment.qaRecordId },
    });
    return row?.facilityId;
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.deletedAt) return json({ error: "Not found" }, 404);
    const facilityId = await facilityIdFor(attachment);
    if (!facilityId) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, facilityId);
    const url = await signedGetUrl(attachment.s3Key);
    if (new URL(request.url).searchParams.get("json") === "1") {
      return json({ url, fileName: attachment.fileName });
    }
    return NextResponse.redirect(url);
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
    const { id } = await context.params;
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.deletedAt) return json({ error: "Not found" }, 404);
    const facilityId = await facilityIdFor(attachment);
    if (!facilityId) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, facilityId);
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.attachment.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: user.id },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "attachment.deleted",
        entityType: "Attachment",
        entityId: id,
        previousValue: { fileName: attachment.fileName },
        ...meta,
      });
    });
    await deleteObject(attachment.s3Key).catch(() => undefined);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
