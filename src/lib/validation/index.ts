/**
 * Zod schemas for every POST/PATCH body.
 * Pair: schema here ↔ route.ts parse() ↔ form fields in src/components/forms.tsx (or incident-forms).
 */
import { z } from "zod";
import { CREDENTIAL_HINT, CREDENTIAL_COMPLEXITY } from "@/lib/password-policy";
import { INCIDENT_STATUS_ALIASES } from "@/lib/incident-status";
import { endAfterStart, endAfterStartMessage } from "@/lib/time-range";

const incidentStatusSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toUpperCase().replaceAll(" ", "_");
  return INCIDENT_STATUS_ALIASES[normalized] ?? normalized;
}, z.enum(["NEW", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "REOPENED", "CLOSED"]));

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(240).optional().nullable(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().email().max(160).optional().nullable(),
);

export const passwordSchema = z
  .string()
  .min(8, CREDENTIAL_HINT)
  .regex(CREDENTIAL_COMPLEXITY, CREDENTIAL_HINT);

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: passwordSchema,
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(["PM_QA", "DEVELOPER", "MANAGEMENT", "ADMIN"]),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  role: z.enum(["PM_QA", "DEVELOPER", "MANAGEMENT", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const regionSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const facilitySchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientOrganizationId: z.string().min(1),
  regionId: z.string().optional().nullable(),
  location: optionalText,
  contactInfo: optionalText,
  contactPerson: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(160).optional().nullable(),
  ),
  contactPhone: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(80).optional().nullable(),
  ),
  contactEmail: optionalEmail,
  updatedAt: z.string().optional(),
});

export const facilityPatchSchema = facilitySchema.partial().extend({
  updatedAt: z.string().min(1, "updatedAt is required"),
});

export const branchSchema = z.object({
  name: z.string().trim().min(2).max(160),
  location: optionalText,
  contactPerson: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(160).optional().nullable(),
  ),
  contactPhone: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(80).optional().nullable(),
  ),
  contactEmail: optionalEmail,
});

export const statusOverrideSchema = z.object({
  status: z.enum([
    "HEALTHY",
    "ATTENTION_REQUIRED",
    "AT_RISK",
    "CRITICAL",
    "INACTIVE",
  ]),
  reason: z.string().trim().min(8).max(500),
  clear: z.boolean().optional(),
  updatedAt: z.string().min(1, "updatedAt is required"),
});

export const assignmentSchema = z.object({
  userId: z.string().min(1),
  assignmentType: z.enum(["PM_QA", "DEVELOPER"]).optional(),
  isLead: z.preprocess(
    (value) => value === true || value === "true",
    z.boolean().optional(),
  ),
  updatedAt: z.string().optional(),
});

export const assignmentPatchSchema = z.object({
  isLead: z.boolean().optional(),
  isActive: z.boolean().optional(),
  updatedAt: z.string().min(1, "updatedAt is required"),
});

// Calendar visits POST this with type: "SITE_VISIT".
export const activitySchema = z
  .object({
    facilityId: z.string().min(1),
    type: z.enum([
      "SITE_VISIT",
      "TRAINING",
      "DEMONSTRATION",
      "DEPLOYMENT",
      "QA",
      "MEETING",
      "FOLLOW_UP",
      "SUPPORT",
      "INSTALLATION",
      "SYSTEM_REVIEW",
      "OTHER",
    ]),
    date: z.string().min(1),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    responsibleUserId: z.string().min(1),
    participantIds: z.array(z.string()).optional(),
    description: z.string().trim().optional().nullable(),
    findings: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((row) => endAfterStart(row.startTime, row.endTime), {
    message: endAfterStartMessage(),
    path: ["endTime"],
  });

export const incidentSchema = z.object({
  facilityId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  description: z.string().trim().min(1, "Incident is required"),
  status: incidentStatusSchema,
  reportedAt: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  relatedActivityId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  updatedAt: z.string().optional(),
});

export const incidentPatchSchema = incidentSchema.partial().extend({
  status: incidentStatusSchema.optional(),
  resolutionInfo: z.string().optional().nullable(),
  comment: z.string().trim().optional().nullable(),
  updatedAt: z.string().min(1, "updatedAt is required"),
});

export const incidentCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const actionSchema = z.object({
  title: z.string().trim().min(4).max(200),
  description: z.string().optional().nullable(),
  facilityId: z.string().min(1),
  ownerId: z.string().min(1),
  sourceType: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),
  incidentId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  dueDate: z.string().min(1),
  notes: z.string().optional().nullable(),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"])
    .optional(),
  updatedAt: z.string().optional(),
});

export const actionPatchSchema = actionSchema.partial().extend({
  updatedAt: z.string().min(1, "updatedAt is required"),
});

export const reportSchema = z.object({
  type: z.enum(["SITE_VISIT", "INCIDENT", "QA", "TRAINING", "DEPLOYMENT", "OPERATIONAL"]),
  facilityId: z.string().min(1),
  activityId: z.string().optional().nullable(),
  incidentId: z.string().optional().nullable(),
  date: z.string().min(1),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED"]).optional(),
  content: z.record(z.string(), z.unknown()).optional().default({}),
});

export const generateReportSchema = z.object({
  facilityId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  from: z.string().min(1),
  to: z.string().min(1),
});

export const qaRecordSchema = z.object({
  facilityId: z.string().min(1),
  relatedIncidentId: z.string().optional().nullable(),
  qaDate: z.string().min(1),
  itemsTested: z.unknown().optional(),
  result: z.enum(["PASSED", "FAILED", "PASSED_WITH_ISSUES", "REQUIRES_RETEST"]),
  findings: z.string().optional().nullable(),
  requiredCorrections: z.string().optional().nullable(),
  retestDate: z.string().optional().nullable(),
  finalVerification: z.boolean().optional(),
});

export const handoverSchema = z.object({
  fromUserId: z.string().optional().nullable(),
  toUserId: z.string().min(1, "Choose who receives the handover"),
  notes: z.string().optional().nullable(),
});

export const handoverReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const facilityHealthSettingsSchema = z.object({
  critical: z.object({
    criticalOpenMin: z.number().int().min(0).max(100),
    unresolvedHighOver7DaysMin: z.number().int().min(0).max(100),
  }),
  atRisk: z.object({
    openIncidentsMin: z.number().int().min(0).max(100),
    highPriorityOpenMin: z.number().int().min(0).max(100),
    overdueActionsMin: z.number().int().min(0).max(100),
    unresolvedHighOver7DaysMin: z.number().int().min(0).max(100),
  }),
  attention: z.object({
    openIncidentsMin: z.number().int().min(0).max(100),
    overdueActionsMin: z.number().int().min(0).max(100),
    oldPendingQAMin: z.number().int().min(0).max(100),
  }),
});

export type FacilityHealthSettingsInput = z.infer<typeof facilityHealthSettingsSchema>;
