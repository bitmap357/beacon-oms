/** POST file to MinIO/S3 and create Attachment row. */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES, putObject } from "@/lib/storage";
import type { AttachmentRelatedType } from "@/lib/db-types";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const file = form.get("file");
    const relatedType = String(form.get("relatedType") || "") as AttachmentRelatedType;
    const relatedId = String(form.get("relatedId") || "");
    if (!(file instanceof File)) throw new HttpError(400, "File is required");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new HttpError(400, "File exceeds 20 MB");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(buffer);
    const mime = detected?.mime || file.type;
    if (!ALLOWED_MIME.has(mime)) {
      throw new HttpError(400, "File type is not allowed");
    }

    let activityId: string | undefined;
    let incidentId: string | undefined;
    let reportId: string | undefined;
    let qaRecordId: string | undefined;
    let facilityId = "";

    if (relatedType === "ACTIVITY") {
      const row = await prisma.activity.findUnique({ where: { id: relatedId } });
      if (!row) throw new HttpError(404, "Not found");
      activityId = row.id;
      facilityId = row.facilityId;
    } else if (relatedType === "INCIDENT") {
      const row = await prisma.incident.findUnique({ where: { id: relatedId } });
      if (!row) throw new HttpError(404, "Not found");
      incidentId = row.id;
      facilityId = row.facilityId;
    } else if (relatedType === "REPORT") {
      const row = await prisma.report.findUnique({ where: { id: relatedId } });
      if (!row) throw new HttpError(404, "Not found");
      reportId = row.id;
      facilityId = row.facilityId;
    } else if (relatedType === "QA_RECORD") {
      const row = await prisma.qARecord.findUnique({ where: { id: relatedId } });
      if (!row) throw new HttpError(404, "Not found");
      qaRecordId = row.id;
      facilityId = row.facilityId;
    } else {
      throw new HttpError(400, "Invalid related type");
    }

    await assertFacilityAccess(user, facilityId);
    const key = `${relatedType.toLowerCase()}/${relatedId}/${randomUUID()}-${file.name.replaceAll(/[^a-zA-Z0-9._-]/g, "_")}`;
    await putObject(key, buffer, mime);
    const meta = requestMeta(request);
    const attachment = await prisma.$transaction(async (tx) => {
      const next = await tx.attachment.create({
        data: {
          fileName: file.name,
          fileType: mime,
          fileSizeBytes: file.size,
          s3Key: key,
          uploadedById: user.id,
          relatedType,
          activityId,
          incidentId,
          reportId,
          qaRecordId,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "attachment.uploaded",
        entityType: "Attachment",
        entityId: next.id,
        newValue: { fileName: next.fileName, relatedType, relatedId },
        ...meta,
      });
      return next;
    });
    return json({ attachment }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
