/**
 * Should we tell PM/QA to visit this facility?
 * Uses last SITE_VISIT activity + open incidents. Worker emails leads when VISIT_DUE / URGENT_VISIT.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { daysBetween } from "@/lib/utils";
import { OPEN_INCIDENT_STATUSES } from "@/lib/incident-status";

export type VisitResult = {
  recommendation: "NOT_DUE" | "VISIT_RECOMMENDED" | "VISIT_DUE" | "URGENT_VISIT";
  reason: string | null;
  daysSinceLastVisit: number | null;
};

const OPEN = OPEN_INCIDENT_STATUSES;

export async function calculateVisitRecommendation(
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<VisitResult> {
  const facility = await client.facility.findUnique({
    where: { id: facilityId },
  });
  if (!facility) {
    return { recommendation: "NOT_DUE", reason: null, daysSinceLastVisit: null };
  }

  const [lastVisit, openIncidents, overdueActions, criticalOpen, highOpen] =
    await Promise.all([
      client.activity.findFirst({
        where: { facilityId, type: "SITE_VISIT" },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
      client.incident.count({
        where: { facilityId, status: { in: [...OPEN] } },
      }),
      client.action.count({
        where: {
          facilityId,
          dueDate: { lt: new Date() },
          status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
        },
      }),
      client.incident.count({
        where: {
          facilityId,
          status: { in: [...OPEN] },
          priority: "CRITICAL",
        },
      }),
      client.incident.count({
        where: {
          facilityId,
          status: { in: [...OPEN] },
          priority: "HIGH",
        },
      }),
    ]);

  const daysSinceLastVisit = lastVisit
    ? daysBetween(lastVisit.date)
    : 999;

  if (
    criticalOpen > 0 ||
    highOpen >= 2 ||
    facility.managementRequestedUrgentVisit
  ) {
    const parts = [];
    if (criticalOpen > 0) parts.push(`${criticalOpen} critical incident(s)`);
    if (highOpen >= 2) parts.push(`${highOpen} high-priority incidents`);
    if (facility.managementRequestedUrgentVisit) {
      parts.push("management requested an urgent visit");
    }
    return {
      recommendation: "URGENT_VISIT",
      reason: parts.join(" + "),
      daysSinceLastVisit: lastVisit ? daysSinceLastVisit : null,
    };
  }

  if (daysSinceLastVisit >= 30) {
    return {
      recommendation: "VISIT_DUE",
      reason: `${daysSinceLastVisit} days since last visit`,
      daysSinceLastVisit,
    };
  }

  if (daysSinceLastVisit >= 21 || openIncidents >= 2 || overdueActions >= 2) {
    const parts = [];
    if (daysSinceLastVisit >= 21) {
      parts.push(`${daysSinceLastVisit} days since last visit`);
    }
    if (openIncidents >= 2) parts.push(`${openIncidents} open incidents`);
    if (overdueActions >= 2) parts.push(`${overdueActions} overdue actions`);
    return {
      recommendation: "VISIT_RECOMMENDED",
      reason: parts.join(" + "),
      daysSinceLastVisit: lastVisit ? daysSinceLastVisit : null,
    };
  }

  return {
    recommendation: "NOT_DUE",
    reason: null,
    daysSinceLastVisit: lastVisit ? daysSinceLastVisit : null,
  };
}
