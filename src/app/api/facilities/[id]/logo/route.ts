/**
 * Facility logo: raster only (png/jpeg/webp), 2 MB, facilities.manage to write.
 * Stored on Facility.logoS3Key — not Attachment — so reports can resolve one file.
 * SVG is rejected (XSS). Missing logo → 404; UI/reports fall back to the Beacon mark.
 */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  ALLOWED_LOGO_MIME,
  LOGO_EXT,
  MAX_LOGO_BYTES,
  deleteObject,
  getObjectBuffer,
  putObject,
} from "@/lib/storage";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const facility = await prisma.facility.findUnique({
      where: { id },
      select: { logoS3Key: true, logoFileType: true },
    });
    if (!facility?.logoS3Key || !facility.logoFileType) {
      return json({ error: "Not found" }, 404);
    }
    if (!ALLOWED_LOGO_MIME.has(facility.logoFileType)) {
      return json({ error: "Not found" }, 404);
    }
    const buffer = await getObjectBuffer(facility.logoS3Key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": facility.logoFileType,
        "Cache-Control": "private, no-store",
      },
    });
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
    requireApiPermission(user, "facilities.manage");
    const limited = await rateLimit(clientKey(request, "facility-logo"), 20, 60);
    if (!limited.ok) return json({ error: "Too many upload requests" }, 429);
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "File is required");
    if (file.size > MAX_LOGO_BYTES) throw new HttpError(400, "Logo must be 2 MB or smaller");
    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(buffer);
    const mime = detected?.mime || "";
    if (!ALLOWED_LOGO_MIME.has(mime)) {
      throw new HttpError(400, "Use a PNG, JPEG, or WebP image");
    }
    const previous = await prisma.facility.findUnique({
      where: { id },
      select: { logoS3Key: true },
    });
    if (!previous) return json({ error: "Not found" }, 404);
    const key = `facility/${id}/logo.${LOGO_EXT[mime]}`;
    await putObject(key, buffer, mime);
    if (previous.logoS3Key && previous.logoS3Key !== key) {
      await deleteObject(previous.logoS3Key).catch(() => undefined);
    }
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.facility.update({
        where: { id },
        data: { logoS3Key: key, logoFileType: mime },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "facility.logo.updated",
        entityType: "Facility",
        entityId: id,
        newValue: { mime, bytes: file.size },
        ...meta,
      });
    });
    return json({ ok: true });
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
    requireApiPermission(user, "facilities.manage");
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const previous = await prisma.facility.findUnique({
      where: { id },
      select: { logoS3Key: true },
    });
    if (!previous) return json({ error: "Not found" }, 404);
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.facility.update({
        where: { id },
        data: { logoS3Key: null, logoFileType: null },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "facility.logo.removed",
        entityType: "Facility",
        entityId: id,
        previousValue: { logoS3Key: previous.logoS3Key },
        ...meta,
      });
    });
    if (previous.logoS3Key) await deleteObject(previous.logoS3Key).catch(() => undefined);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
