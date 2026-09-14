/** POST a region under an organisation. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { regionSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const regions = await prisma.region.findMany({
      where: { clientOrganizationId: id },
      orderBy: { name: "asc" },
    });
    return json({ regions });
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
    const { id } = await context.params;
    const body = regionSchema.parse(await request.json());
    const meta = requestMeta(request);
    const region = await prisma.$transaction(async (tx) => {
      const next = await tx.region.create({
        data: { name: body.name, clientOrganizationId: id },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "region.created",
        entityType: "Region",
        entityId: next.id,
        newValue: { name: next.name, clientOrganizationId: id },
        ...meta,
      });
      return next;
    });
    return json({ region }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
