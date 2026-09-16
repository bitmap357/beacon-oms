/** GET/POST facilities. Scoped by getAccessibleFacilityIds. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { facilitySchema } from "@/lib/validation";
import type { FacilityHealth } from "@/lib/db-types";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as FacilityHealth | null;
    const org = url.searchParams.get("org");
    const region = url.searchParams.get("region");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const take = 25;
    const where = {
      id: { in: ids },
      ...(status ? { status } : {}),
      ...(org ? { clientOrganizationId: org } : {}),
      ...(region ? { regionId: region } : {}),
    };
    const [total, facilities] = await Promise.all([
      prisma.facility.count({ where }),
      prisma.facility.findMany({
        where,
        include: {
          clientOrganization: true,
          region: true,
          assignments: {
            where: { isActive: true },
            include: { user: { select: { id: true, name: true, role: true } } },
          },
          _count: {
            select: { incidents: true, actions: true },
          },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * take,
        take,
      }),
    ]);
    return json({ facilities, total, page, take });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "facilities.manage");
    const body = facilitySchema.parse(await request.json());
    const meta = requestMeta(request);
    const facility = await prisma.$transaction(async (tx) => {
      const next = await tx.facility.create({
        data: {
          name: body.name,
          clientOrganizationId: body.clientOrganizationId,
          regionId: body.regionId || null,
          location: body.location || null,
          contactInfo: body.contactInfo || body.contactPerson || null,
          contactPerson: body.contactPerson || null,
          contactPhone: body.contactPhone || null,
          contactEmail: body.contactEmail || null,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "facility.created",
        entityType: "Facility",
        entityId: next.id,
        newValue: { name: next.name },
        ...meta,
      });
      return next;
    });
    return json({ facility }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
