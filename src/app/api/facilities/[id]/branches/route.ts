/** POST a branch (ward/lab) on a facility. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  HttpError,
  errorResponse,
  json,
  requireApiPermission,
  requireApiUser,
} from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { branchSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const branches = await prisma.facilityBranch.findMany({
      where: { facilityId: id },
      orderBy: { name: "asc" },
    });
    return json({ branches });
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
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const body = branchSchema.parse(await request.json());
    const meta = requestMeta(request);
    const branch = await prisma.$transaction(async (tx) => {
      const next = await tx.facilityBranch.create({
        data: {
          facilityId: id,
          name: body.name,
          location: body.location || null,
          contactPerson: body.contactPerson || null,
          contactPhone: body.contactPhone || null,
          contactEmail: body.contactEmail || null,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "branch.created",
        entityType: "FacilityBranch",
        entityId: next.id,
        newValue: { name: next.name, facilityId: id },
        ...meta,
      });
      return next;
    });
    return json({ branch }, 201);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return errorResponse(new HttpError(409, "A branch with that name already exists"));
    }
    return errorResponse(error);
  }
}
