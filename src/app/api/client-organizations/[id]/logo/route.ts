/**
 * Organization logo: raster only (png/jpeg/webp), 2 MB, orgs.manage to write.
 * Stored on ClientOrganization.logoS3Key — not Attachment — so reports resolve one file.
 * SVG is rejected (XSS). Missing logo → 404; UI/reports omit the slot.
 */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
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
    requireApiPermission(user, "orgs.read");
    const { id } = await context.params;
    const organization = await prisma.clientOrganization.findUnique({
      where: { id },
      select: { logoS3Key: true, logoFileType: true },
    });
    if (!organization?.logoS3Key || !organization.logoFileType) {
      return json({ error: "Not found" }, 404);
    }
    if (!ALLOWED_LOGO_MIME.has(organization.logoFileType)) {
      return json({ error: "Not found" }, 404);
    }
    const buffer = await getObjectBuffer(organization.logoS3Key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": organization.logoFileType,
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
    requireApiPermission(user, "orgs.manage");
    const limited = await rateLimit(clientKey(request, "org-logo"), 20, 60);
    if (!limited.ok) return json({ error: "Too many upload requests" }, 429);
    const { id } = await context.params;
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
    const previous = await prisma.clientOrganization.findUnique({
      where: { id },
      select: { logoS3Key: true },
    });
    if (!previous) return json({ error: "Not found" }, 404);
    const key = `organization/${id}/logo.${LOGO_EXT[mime]}`;
    await putObject(key, buffer, mime);
    if (previous.logoS3Key && previous.logoS3Key !== key) {
      await deleteObject(previous.logoS3Key).catch(() => undefined);
    }
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.clientOrganization.update({
        where: { id },
        data: { logoS3Key: key, logoFileType: mime },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "organization.logo.updated",
        entityType: "ClientOrganization",
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
    requireApiPermission(user, "orgs.manage");
    const { id } = await context.params;
    const previous = await prisma.clientOrganization.findUnique({
      where: { id },
      select: { logoS3Key: true },
    });
    if (!previous) return json({ error: "Not found" }, 404);
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.clientOrganization.update({
        where: { id },
        data: { logoS3Key: null, logoFileType: null },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "organization.logo.removed",
        entityType: "ClientOrganization",
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
