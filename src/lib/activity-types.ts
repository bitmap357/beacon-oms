/** Visit / activity types used on the calendar and facility timeline. */
import type { ActivityType, ReportType } from "@/lib/db-types";

export const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: "SITE_VISIT", label: "Site visit" },
  { value: "TRAINING", label: "Training" },
  { value: "DEMONSTRATION", label: "Demonstration" },
  { value: "DEPLOYMENT", label: "Deployment" },
  { value: "MEETING", label: "Meeting" },
  { value: "FOLLOW_UP", label: "Follow up" },
  { value: "QA", label: "QA" },
  { value: "SUPPORT", label: "Support" },
  { value: "INSTALLATION", label: "Installation" },
  { value: "SYSTEM_REVIEW", label: "System Review" },
  { value: "OTHER", label: "Other" },
];

export const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map((row) => row.value);

export const VISIT_TYPES: ActivityType[] = [
  "SITE_VISIT",
  "TRAINING",
  "DEMONSTRATION",
  "DEPLOYMENT",
  "INSTALLATION",
  "SYSTEM_REVIEW",
];

export function labelActivityType(type: string) {
  return ACTIVITY_TYPES.find((row) => row.value === type)?.label ?? type.replaceAll("_", " ").toLowerCase();
}

export function isVisitType(type: string) {
  return VISIT_TYPES.includes(type as ActivityType);
}

export function reportTypeForActivity(type: string): ReportType {
  if (type === "TRAINING" || type === "DEPLOYMENT" || type === "QA") return type;
  return "SITE_VISIT";
}

export async function uploadActivityFile(activityId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  form.set("relatedType", "ACTIVITY");
  form.set("relatedId", activityId);
  const res = await fetch("/api/attachments", { method: "POST", body: form, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Session expired. Sign in again.");
  if (!res.ok) throw new Error(data.error || "Could not attach the report file");
  return data;
}
