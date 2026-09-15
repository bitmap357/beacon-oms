/** JSON metrics if a client wants the dashboard data without HTML. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { OPEN_INCIDENT_STATUS_QUERY, OPEN_ACTION_STATUSES } from "@/lib/incident-status";

const OPEN = OPEN_INCIDENT_STATUS_QUERY;

export async function GET() {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    const [
      totalFacilities,
      activeFacilities,
      attention,
      openIncidents,
      criticalIncidents,
      overdueActions,
      activitiesThisWeek,
      pendingQa,
      facilities,
    ] = await Promise.all([
      prisma.facility.count({ where: { id: { in: ids } } }),
      prisma.facility.count({
        where: { id: { in: ids }, status: { not: "INACTIVE" } },
      }),
      prisma.facility.count({
        where: {
          id: { in: ids },
          status: { in: ["ATTENTION_REQUIRED", "AT_RISK", "CRITICAL"] },
        },
      }),
      prisma.incident.count({
        where: { facilityId: { in: ids }, status: { in: [...OPEN] } },
      }),
      prisma.incident.count({
        where: {
          facilityId: { in: ids },
          status: { in: [...OPEN] },
          priority: "CRITICAL",
        },
      }),
      prisma.action.count({
        where: {
          facilityId: { in: ids },
          dueDate: { lt: now },
          status: { in: [...OPEN_ACTION_STATUSES] },
        },
      }),
      prisma.activity.count({
        where: { facilityId: { in: ids }, date: { gte: weekStart } },
      }),
      prisma.qARecord.count({
        where: {
          facilityId: { in: ids },
          result: { in: ["FAILED", "REQUIRES_RETEST"] },
        },
      }),
      prisma.facility.findMany({
        where: { id: { in: ids } },
        include: { clientOrganization: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
    ]);

    const health = await prisma.facility.groupBy({
      by: ["status"],
      where: { id: { in: ids } },
      _count: { status: true },
    });

    const visits = [];
    for (const facility of facilities) {
      const rec = await calculateVisitRecommendation(facility.id);
      if (rec.recommendation !== "NOT_DUE") {
        visits.push({
          facilityId: facility.id,
          name: facility.name,
          ...rec,
        });
      }
    }

    const pmUsers = await prisma.user.findMany({
      where: { role: "PM_QA", isActive: true },
      select: { id: true, name: true },
    });
    const workload = await Promise.all(
      pmUsers.map(async (pm) => {
        const assigned = await prisma.facilityAssignment.findMany({
          where: { userId: pm.id, isActive: true },
          select: { facilityId: true, isLead: true },
        });
        const facilityIds = assigned.map((row) => row.facilityId);
        const [openInc, openAct, overdue] = await Promise.all([
          prisma.incident.count({
            where: { facilityId: { in: facilityIds }, status: { in: [...OPEN] } },
          }),
          prisma.action.count({
            where: {
              facilityId: { in: facilityIds },
              status: { in: [...OPEN_ACTION_STATUSES] },
            },
          }),
          prisma.action.count({
            where: {
              facilityId: { in: facilityIds },
              dueDate: { lt: now },
              status: { in: [...OPEN_ACTION_STATUSES] },
            },
          }),
        ]);
        return {
          id: pm.id,
          name: pm.name,
          facilities: assigned.length,
          leadFacilities: assigned.filter((row) => row.isLead).length,
          openIncidents: openInc,
          openActions: openAct,
          overdueActions: overdue,
        };
      }),
    );

    return json({
      metrics: {
        totalFacilities,
        activeFacilities,
        attention,
        openIncidents,
        criticalIncidents,
        overdueActions,
        activitiesThisWeek,
        visitsDue: visits.length,
        pendingQa,
      },
      health: health.map((row) => ({ status: row.status, count: row._count.status })),
      visits,
      workload,
      facilities,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
