/**
 * Allowed string values for SQL Server columns that used to be Prisma enums.
 * Change a union here, then the matching Zod enum in src/lib/validation/index.ts,
 * and any ROLE_PERMISSIONS / status maps that switch on the value.
 *
 * JSON helpers: SQL Server stores objects as NVARCHAR — stringify on write, parse on read.
 */
export type UserRole = "PM_QA" | "DEVELOPER" | "MANAGEMENT" | "ADMIN";
export type AssignmentType = "PM_QA" | "DEVELOPER";
export type FacilityHealth =
  | "HEALTHY"
  | "ATTENTION_REQUIRED"
  | "AT_RISK"
  | "CRITICAL"
  | "INACTIVE";
export type ActivityType =
  | "SITE_VISIT"
  | "TRAINING"
  | "DEMONSTRATION"
  | "DEPLOYMENT"
  | "QA"
  | "MEETING"
  | "FOLLOW_UP"
  | "SUPPORT"
  | "INSTALLATION"
  | "SYSTEM_REVIEW"
  | "OTHER";
export type IncidentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "REOPENED"
  | "CLOSED";
export type ActionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";
export type ReportType =
  | "SITE_VISIT"
  | "INCIDENT"
  | "QA"
  | "TRAINING"
  | "DEPLOYMENT"
  | "OPERATIONAL";
export type ReportStatus = "DRAFT" | "SUBMITTED" | "REVIEWED";
export type QAResult = "PASSED" | "FAILED" | "PASSED_WITH_ISSUES" | "REQUIRES_RETEST";
export type AttachmentRelatedType = "ACTIVITY" | "INCIDENT" | "REPORT" | "QA_RECORD";
export type NotificationType =
  | "INCIDENT_ASSIGNED"
  | "INCIDENT_STATUS_CHANGED"
  | "INCIDENT_REOPENED"
  | "ACTION_ASSIGNED"
  | "ACTION_DUE_SOON"
  | "ACTION_OVERDUE"
  | "VISIT_DUE"
  | "QA_VERIFICATION_REQUIRED"
  | "HANDOVER_INITIATED"
  | "HANDOVER_COMPLETED"
  | "REPORT_NEEDS_REVIEW";
export type RecordSource = "NATIVE" | "LEGACY";
export type VisitRecommendation = "NOT_DUE" | "VISIT_RECOMMENDED" | "VISIT_DUE" | "URGENT_VISIT";

export function toJsonString(value: unknown) {
  return JSON.stringify(value);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
