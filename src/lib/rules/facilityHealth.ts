/**
 * Facility health score. Called after incidents/QA/actions change, and by src/worker.ts.
 * Thresholds are in calculateFacilityHealth — tweak those numbers to change when a site goes AT_RISK / CRITICAL.
 * Manual override is stored on Facility.statusOverride* (API: status-override).
 */
import type { Prisma } from "@prisma/client";
import type { FacilityHealth } from "@/lib/db-types";
import { prisma } from "@/lib/db";
import { OPEN_INCIDENT_STATUS_QUERY, OPEN_ACTION_STATUSES } from "@/lib/incident-status";

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
      where: { facilityId, status: { in: [...OPEN_INCIDENT_STATUS_QUERY] } },
    }),
    client.incident.count({
      where: {
        facilityId,
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
        priority: { in: ["HIGH", "CRITICAL"] },
      },
    }),
    client.incident.count({
      where: {
        facilityId,
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

export function calculateFacilityHealth(counts: Counts): FacilityHealth {
  if (counts.criticalOpen > 0 || counts.unresolvedHighOver7Days >= 2) {
    return "CRITICAL";
  }
  if (
    counts.openIncidents >= 3 ||
    counts.highPriorityOpen >= 2 ||
    counts.overdueActions >= 3 ||
    counts.unresolvedHighOver7Days >= 1
  ) {
    return "AT_RISK";
  }
  if (
    counts.openIncidents >= 1 ||
    counts.overdueActions >= 1 ||
    counts.oldPendingQA > 0
  ) {
    return "ATTENTION_REQUIRED";
  }
  return "HEALTHY";
}

export async function refreshFacilityHealth(
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const facility = await client.facility.findUnique({
    where: { id: facilityId },
  });
  if (!facility || facility.status === "INACTIVE") return facility;
  const counts = await getFacilityHealthInputs(facilityId, client);
  const calculated = calculateFacilityHealth(counts);
  return client.facility.update({
    where: { id: facilityId },
    data: {
      calculatedStatus: calculated,
      status: facility.statusOverride ? facility.status : calculated,
    },
  });
}
