/** GET/PATCH one facility (name, location, org, region). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  HttpError,
  assertUnchanged,
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { facilitySchema } from "@/lib/validation";

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
      include: {
        clientOrganization: true,
        region: true,
        assignments: {
          include: { user: { select: { id: true, name: true, role: true, email: true } } },
          orderBy: { startDate: "desc" },
        },
      },
    });
    if (!facility) return json({ error: "Not found" }, 404);
    return json({ facility });
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
    requireApiPermission(user, "facilities.manage");
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const body = facilitySchema.partial().parse(await request.json());
    const previous = await prisma.facility.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    assertUnchanged(previous.updatedAt, body.updatedAt);
    const meta = requestMeta(request);
    const facility = await prisma.$transaction(async (tx) => {
      const next = await tx.facility.update({
        where: { id },
        data: {
          name: body.name,
          clientOrganizationId: body.clientOrganizationId,
          regionId: body.regionId,
          location: body.location,
          contactInfo: body.contactInfo,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "facility.updated",
        entityType: "Facility",
        entityId: id,
        previousValue: {
          name: previous.name,
          location: previous.location,
        },
        newValue: { name: next.name, location: next.location },
        ...meta,
      });
      return next;
    });
    return json({ facility });
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
    const facility = await prisma.facility.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            incidents: true,
            actions: true,
            activities: true,
            reports: true,
            assignments: true,
            branches: true,
            qaRecords: true,
            handovers: true,
          },
        },
      },
    });
    if (!facility) return json({ error: "Not found" }, 404);
    const leftover = Object.values(facility._count).reduce((sum, count) => sum + count, 0);
    if (leftover > 0) {
      throw new HttpError(
        400,
        "This facility still has related records. Remove incidents, actions, visits, reports, branches, and assignments first.",
      );
    }
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.facility.delete({ where: { id } });
      await logAudit(tx, {
        userId: user.id,
        action: "facility.deleted",
        entityType: "Facility",
        entityId: id,
        previousValue: { name: facility.name },
        ...meta,
      });
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
