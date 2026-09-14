/** PATCH/GET one organisation. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { organizationSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const organization = await prisma.clientOrganization.findUnique({
      where: { id },
      include: { regions: true, facilities: true },
    });
    if (!organization) return json({ error: "Not found" }, 404);
    return json({ organization });
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
    requireApiPermission(user, "orgs.manage");
    const { id } = await context.params;
    const body = organizationSchema.parse(await request.json());
    const previous = await prisma.clientOrganization.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    const meta = requestMeta(request);
    const organization = await prisma.$transaction(async (tx) => {
      const next = await tx.clientOrganization.update({
        where: { id },
        data: { name: body.name },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "organization.updated",
        entityType: "ClientOrganization",
        entityId: id,
        previousValue: { name: previous.name },
        newValue: { name: next.name },
        ...meta,
      });
      return next;
    });
    return json({ organization });
  } catch (error) {
    return errorResponse(error);
  }
}
