/** Allowed incident statuses. Closed is QA-only (enforced in the PATCH route). */
import type { IncidentStatus } from "@/lib/db-types";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "REOPENED",
  "CLOSED",
];

export const OPEN_INCIDENT_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "REOPENED",
] as const;

/** Legacy values still present in some databases from before the status rename. */
export const INCIDENT_STATUS_ALIASES: Record<string, IncidentStatus> = {
  ASSIGNED: "NEW",
  NOT_STARTED: "NEW",
  ONGOING: "IN_PROGRESS",
  AWAITING_QA: "COMPLETED",
  RESOLVED: "CLOSED",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  NEW: "Not started",
  IN_PROGRESS: "Ongoing",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  REOPENED: "Reopened",
  CLOSED: "Closed",
};

export const OPEN_INCIDENT_STATUS_QUERY = [
  ...OPEN_INCIDENT_STATUSES,
  "ASSIGNED",
  "AWAITING_QA",
] as const;

export const OPEN_ACTION_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] as const;

export function canonicalIncidentStatus(status: string): IncidentStatus | string {
  return INCIDENT_STATUS_ALIASES[status] ?? status;
}

export function isOpenIncidentStatus(status: string) {
  return (OPEN_INCIDENT_STATUS_QUERY as readonly string[]).includes(status);
}

export function isClosedIncidentStatus(status: string) {
  return canonicalIncidentStatus(status) === "CLOSED";
}

export function isOpenActionStatus(status: string) {
  return (OPEN_ACTION_STATUSES as readonly string[]).includes(status);
}

/** Expand a UI/API status filter so legacy rows are included with their canonical value. */
export function incidentStatusesForFilter(status: string | null | undefined) {
  if (!status) return undefined;
  if (status === "open") return [...OPEN_INCIDENT_STATUS_QUERY];
  const canonical = String(canonicalIncidentStatus(status));
  const aliases = Object.entries(INCIDENT_STATUS_ALIASES)
    .filter(([, mapped]) => mapped === canonical)
    .map(([legacy]) => legacy);
  return [...new Set([status, canonical, ...aliases])];
}

export function labelIncidentStatus(status: string) {
  const canonical = canonicalIncidentStatus(status);
  return INCIDENT_STATUS_LABELS[canonical as IncidentStatus] ?? String(canonical).replaceAll("_", " ");
}

export function mergeStatusCounts(
  rows: Array<{ status: string; _count: { status: number } }>,
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = canonicalIncidentStatus(row.status);
    map.set(key, (map.get(key) || 0) + row._count.status);
  }
  return [...map.entries()].map(([status, count]) => ({
    status,
    _count: { status: count },
  }));
}

export function incidentStatusOptions(canClose: boolean): IncidentStatus[] {
  return canClose ? [...INCIDENT_STATUSES] : [...OPEN_INCIDENT_STATUSES];
}

export function dateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
  };
}

export function reportedAtFilter(from?: string | null, to?: string | null) {
  const range = dateRange(from, to);
  return range ? { reportedAt: range } : undefined;
}
