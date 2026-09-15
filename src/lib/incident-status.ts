/** Allowed incident statuses. Closed is QA-only (enforced in the PATCH route). */
import type { IncidentStatus } from "@/lib/db-types";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "REOPENED",
  "CLOSED",
];

export const OPEN_INCIDENT_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "REOPENED",
] as const;

export const OPEN_ACTION_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] as const;

export function incidentStatusOptions(canClose: boolean): IncidentStatus[] {
  return canClose ? [...INCIDENT_STATUSES] : [...OPEN_INCIDENT_STATUSES];
}
