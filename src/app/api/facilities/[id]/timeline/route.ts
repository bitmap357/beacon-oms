/** GET mixed activity/incident/action history for the facility page. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { incidentLabel } from "@/lib/utils";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await assertFacilityAccess(user, id);

    const [activities, incidents, handovers, assignments] = await Promise.all([
      prisma.activity.findMany({
        where: { facilityId: id },
        include: { responsibleUser: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.incident.findMany({
        where: { facilityId: id },
        include: { reporter: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.handover.findMany({
        where: { facilityId: id },
        include: {
          initiatedBy: { select: { name: true } },
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.facilityAssignment.findMany({
        where: { facilityId: id },
        include: { user: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      }),
    ]);

    const items = [
      ...activities.map((row) => ({
        id: row.id,
        kind: "activity" as const,
        at: row.date,
        title: row.type.replaceAll("_", " ").toLowerCase(),
        by: row.responsibleUser.name,
      })),
      ...incidents.map((row) => ({
        id: row.id,
        kind: "incident" as const,
        at: row.createdAt,
        title: incidentLabel(row),
        by: row.reporter.name,
      })),
      ...handovers.map((row) => ({
        id: row.id,
        kind: "handover" as const,
        at: row.createdAt,
        title: `Handover ${row.fromUser?.name ?? "unassigned"} → ${row.toUser?.name ?? "unassigned"}`,
        by: row.initiatedBy.name,
      })),
      ...assignments.map((row) => ({
        id: row.id,
        kind: "assignment" as const,
        at: row.startDate,
        title: `${row.user.name} ${row.isActive ? "assigned" : "removed"}`,
        by: row.user.name,
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
