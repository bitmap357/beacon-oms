/**
 * Facility health score. Called after incidents/QA/actions change, and by src/worker.ts.
 * Thresholds load from AppSetting (admin UI) with defaults matching historic hardcoded rules.
 * Manual override is stored on Facility.statusOverride* (API: status-override).
 */
import type { Prisma } from "@prisma/client";
import type { FacilityHealth } from "@/lib/db-types";
import { prisma } from "@/lib/db";
import { OPEN_INCIDENT_STATUS_QUERY, OPEN_ACTION_STATUSES } from "@/lib/incident-status";
import {
  DEFAULT_FACILITY_HEALTH,
  getFacilityHealthThresholds,
  type FacilityHealthThresholds,
} from "@/lib/settings";

type Counts = {
  openIncidents: number;
  highPriorityOpen: number;
  criticalOpen: number;
  overdueActions: number;
  oldPendingQA: number;
  unresolvedHighOver7Days: number;
};

export async function getFacilityHealthInputs(
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Counts> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    openIncidents,
    highPriorityOpen,
    criticalOpen,
    overdueActions,
    oldPendingQA,
    unresolvedHighOver7Days,
  ] = await Promise.all([
    client.incident.count({
      where: { facilityId, archivedAt: null, status: { in: [...OPEN_INCIDENT_STATUS_QUERY] } },
    }),
    client.incident.count({
      where: {
        facilityId,
        archivedAt: null,
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
        priority: { in: ["HIGH", "CRITICAL"] },
      },
    }),
    client.incident.count({
      where: {
        facilityId,
        archivedAt: null,
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
        priority: "CRITICAL",
      },
    }),
    client.action.count({
      where: {
        facilityId,
        dueDate: { lt: now },
        status: { in: [...OPEN_ACTION_STATUSES] },
      },
    }),
    client.qARecord.count({
      where: {
        facilityId,
        result: { in: ["FAILED", "REQUIRES_RETEST"] },
        qaDate: { lt: sevenDaysAgo },
      },
    }),
    client.incident.count({
      where: {
        facilityId,
        archivedAt: null,
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
        priority: { in: ["HIGH", "CRITICAL"] },
        createdAt: { lt: sevenDaysAgo },
      },
    }),
  ]);

  return {
    openIncidents,
    highPriorityOpen,
    criticalOpen,
    overdueActions,
    oldPendingQA,
    unresolvedHighOver7Days,
  };
}

export function calculateFacilityHealth(
  counts: Counts,
  thresholds: FacilityHealthThresholds = DEFAULT_FACILITY_HEALTH,
): FacilityHealth {
  const { critical, atRisk, attention } = thresholds;
  if (
    counts.criticalOpen >= critical.criticalOpenMin ||
    counts.unresolvedHighOver7Days >= critical.unresolvedHighOver7DaysMin
  ) {
    return "CRITICAL";
  }
  if (
    counts.openIncidents >= atRisk.openIncidentsMin ||
    counts.highPriorityOpen >= atRisk.highPriorityOpenMin ||
    counts.overdueActions >= atRisk.overdueActionsMin ||
    counts.unresolvedHighOver7Days >= atRisk.unresolvedHighOver7DaysMin
  ) {
    return "AT_RISK";
  }
  if (
    counts.openIncidents >= attention.openIncidentsMin ||
    counts.overdueActions >= attention.overdueActionsMin ||
    counts.oldPendingQA >= attention.oldPendingQAMin
  ) {
    return "ATTENTION_REQUIRED";
  }
  return "HEALTHY";
}

/** Short copy for the facility page status area (navy/gold UI). */
export function describeFacilityHealthCriteria(
  thresholds: FacilityHealthThresholds = DEFAULT_FACILITY_HEALTH,
) {
  return [
    {
      status: "HEALTHY",
      rule: "No open incidents, no overdue actions, and no failed QA older than 7 days (below attention thresholds).",
    },
    {
      status: "ATTENTION_REQUIRED",
      rule: `${thresholds.attention.openIncidentsMin}+ open incident(s), ${thresholds.attention.overdueActionsMin}+ overdue action(s), or ${thresholds.attention.oldPendingQAMin}+ failed/retest QA older than 7 days.`,
    },
    {
      status: "AT_RISK",
      rule: `${thresholds.atRisk.openIncidentsMin}+ open incidents, ${thresholds.atRisk.highPriorityOpenMin}+ high/critical open, ${thresholds.atRisk.overdueActionsMin}+ overdue actions, or ${thresholds.atRisk.unresolvedHighOver7DaysMin}+ high/critical open older than 7 days.`,
    },
    {
      status: "CRITICAL",
      rule: `${thresholds.critical.criticalOpenMin}+ open critical-priority incident(s), or ${thresholds.critical.unresolvedHighOver7DaysMin}+ high/critical incidents open longer than 7 days.`,
    },
  ] as const;
}

/** Static fallback copy; prefer describeFacilityHealthCriteria with live settings. */
export const FACILITY_HEALTH_CRITERIA = describeFacilityHealthCriteria();

export async function refreshFacilityHealth(
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const facility = await client.facility.findUnique({
    where: { id: facilityId },
  });
  if (!facility || facility.status === "INACTIVE") return facility;
  const [counts, thresholds] = await Promise.all([
    getFacilityHealthInputs(facilityId, client),
    getFacilityHealthThresholds(client),
  ]);
  const calculated = calculateFacilityHealth(counts, thresholds);
  return client.facility.update({
    where: { id: facilityId },
    data: {
      calculatedStatus: calculated,
      status: facility.statusOverride ? facility.status : calculated,
    },
  });
}
