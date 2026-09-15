/** Allowed next statuses. Edit here (and keep the PATCH route in sync). */
import type { IncidentStatus } from "@/lib/db-types";

export const OPEN_INCIDENT_STATUSES = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "AWAITING_QA",
  "REOPENED",
] as const;

export const OPEN_ACTION_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] as const;

export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  NEW: ["ASSIGNED", "IN_PROGRESS"],
  ASSIGNED: ["IN_PROGRESS", "NEW"],
  IN_PROGRESS: ["AWAITING_QA", "RESOLVED"],
  AWAITING_QA: ["RESOLVED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "AWAITING_QA"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
};

export function nextIncidentStatuses(current: IncidentStatus): IncidentStatus[] {
  return [current, ...INCIDENT_TRANSITIONS[current].filter((status) => status !== current)];
}
