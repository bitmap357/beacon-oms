/** GET incident field history. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const incident = await prisma.incident.findUnique({
      where: { id },
      select: { facilityId: true },
    });
    if (!incident) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, incident.facilityId);
    const history = await prisma.incidentHistory.findMany({
      where: { incidentId: id },
      orderBy: { changedAt: "asc" },
    });
    return json({ history });
  } catch (error) {
    return errorResponse(error);
  }
}
