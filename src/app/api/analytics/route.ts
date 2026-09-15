/** JSON for the analytics page charts. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { getAccessibleFacilityIds } from "@/lib/permissions";

import { OPEN_INCIDENT_STATUSES } from "@/lib/incident-status";

const OPEN = OPEN_INCIDENT_STATUSES;

export async function GET() {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "analytics.view");
    const ids = await getAccessibleFacilityIds(user);

    const [byPriority, byFacility, reopened, incidents] = await Promise.all([
      prisma.incident.groupBy({
        by: ["priority"],
        where: { facilityId: { in: ids } },
        _count: { priority: true },
      }),
      prisma.incident.groupBy({
        by: ["facilityId"],
        where: { facilityId: { in: ids } },
        _count: { facilityId: true },
      }),
      prisma.incident.count({
        where: { facilityId: { in: ids }, status: "REOPENED" },
      }),
      prisma.incident.findMany({
        where: { facilityId: { in: ids } },
        select: { createdAt: true, resolvedAt: true, status: true, facilityId: true },
      }),
    ]);

    const resolved = incidents.filter((row) => row.resolvedAt);
    const avgResolutionHours =
      resolved.length === 0
        ? 0
        : Math.round(
            resolved.reduce(
              (sum, row) =>
                sum +
                ((row.resolvedAt as Date).getTime() - row.createdAt.getTime()) /
                  36e5,
              0,
            ) / resolved.length,
          );

    const byMonthMap = new Map<string, number>();
    for (const row of incidents) {
      const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`;
      byMonthMap.set(key, (byMonthMap.get(key) || 0) + 1);
    }

    const facilities = await prisma.facility.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(facilities.map((row) => [row.id, row.name]));

    const team = await prisma.user.findMany({
      where: { role: { in: ["PM_QA", "DEVELOPER"] }, isActive: true },
      select: { id: true, name: true, role: true },
    });
    const teamInsights = await Promise.all(
      team.map(async (member) => {
        const assigned = await prisma.facilityAssignment.count({
          where: { userId: member.id, isActive: true },
        });
        const openIncidents = await prisma.incident.count({
          where: { assigneeId: member.id, status: { in: [...OPEN] } },
        });
        const openActions = await prisma.action.count({
          where: {
            ownerId: member.id,
            status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
          },
        });
        const overdue = await prisma.action.count({
          where: {
            ownerId: member.id,
            dueDate: { lt: new Date() },
            status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
          },
        });
        const activityVolume = await prisma.activity.count({
          where: { responsibleUserId: member.id },
        });
        return {
          ...member,
          assigned,
          openIncidents,
          openActions,
          overdue,
          activityVolume,
        };
      }),
    );

    return json({
      incidents: {
        byPriority: byPriority.map((row) => ({
          priority: row.priority,
          count: row._count.priority,
        })),
        byFacility: byFacility.map((row) => ({
          facilityId: row.facilityId,
          name: nameById[row.facilityId] || row.facilityId,
          count: row._count.facilityId,
        })),
        byMonth: [...byMonthMap.entries()].map(([month, count]) => ({
          month,
          count,
        })),
        avgResolutionHours,
        reopened,
      },
      team: teamInsights,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
