/** GET/POST client organisations (top of org → facility tree). */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { organizationSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "orgs.read");
    const organizations = await prisma.clientOrganization.findMany({
      include: { regions: true, _count: { select: { facilities: true } } },
      orderBy: { name: "asc" },
    });
    return json({ organizations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "orgs.manage");
    const body = organizationSchema.parse(await request.json());
    const meta = requestMeta(request);
    const created = await prisma.$transaction(async (tx) => {
      const next = await tx.clientOrganization.create({ data: { name: body.name } });
      await logAudit(tx, {
        userId: user.id,
        action: "organization.created",
        entityType: "ClientOrganization",
        entityId: next.id,
        newValue: { name: next.name },
        ...meta,
      });
      return next;
    });
    return json({ organization: created }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
