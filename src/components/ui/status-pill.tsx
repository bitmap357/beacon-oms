/** Status and priority colour pills. One tone map for lists, detail, charts, and reports. */
import type { FacilityHealth, QAResult, ReportStatus, VisitRecommendation } from "@/lib/db-types";
import { canonicalIncidentStatus, labelIncidentStatus } from "@/lib/incident-status";
import { cn, labelize } from "@/lib/utils";

const STATUS_STYLES: Record<FacilityHealth, string> = {
  HEALTHY: "bg-status-healthy-bg text-status-healthy-fg",
  ATTENTION_REQUIRED: "bg-status-attention-bg text-status-attention-fg",
  AT_RISK: "bg-status-atrisk-bg text-status-atrisk-fg",
  CRITICAL: "bg-status-critical-bg text-status-critical-fg",
  INACTIVE: "bg-status-inactive-bg text-status-inactive-fg",
};

export type Tone = "neutral" | "danger" | "warn" | "ok" | "gold" | "brand";

/** Chart/print hex — the foreground of each tone, navy/gold/status only. */
export const TONE_HEX: Record<Tone, string> = {
  neutral: "#5B6472",
  danger: "#791F1F",
  warn: "#854F0B",
  ok: "#1D6B45",
  gold: "#E8B923",
  brand: "#1558D6",
};

export const FACILITY_HEALTH_HEX: Record<FacilityHealth, string> = {
  HEALTHY: "#1D6B45",
  ATTENTION_REQUIRED: "#854F0B",
  AT_RISK: "#8A3A16",
  CRITICAL: "#791F1F",
  INACTIVE: "#5B6472",
};

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-status-inactive-bg text-status-inactive-fg",
  danger: "bg-status-critical-bg text-status-critical-fg",
  warn: "bg-status-attention-bg text-status-attention-fg",
  ok: "bg-status-healthy-bg text-status-healthy-fg",
  gold: "bg-status-gold-bg text-status-gold-fg",
  brand: "bg-status-brand-bg text-status-brand-fg",
};

/** Shared tone classes for pills and the incident status picker trigger. */
export function tonePillClass(tone: Tone = "neutral") {
  return TONE_STYLES[tone];
}

export function StatusPill({
  status,
  className,
}: {
  status: FacilityHealth | string;
  className?: string;
}) {
  const style = STATUS_STYLES[status as FacilityHealth];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 tracking-[0.01em] transition-[background-color,color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
        style ?? TONE_STYLES.neutral,
        className,
      )}
    >
      {labelize(status)}
    </span>
  );
}

export function TonePill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 tracking-[0.01em] transition-[background-color,color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
        tonePillClass(tone),
      )}
    >
      {children}
    </span>
  );
}

export function incidentStatusTone(status: string): Tone {
  const canonical = String(canonicalIncidentStatus(status));
  if (canonical === "NEW") return "neutral";
  if (canonical === "IN_PROGRESS") return "brand";
  if (canonical === "ON_HOLD") return "warn";
  if (canonical === "REOPENED") return "danger";
  if (canonical === "COMPLETED") return "gold";
  if (canonical === "CLOSED") return "ok";
  return "neutral";
}

export function priorityTone(priority: string): Tone {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "warn";
  if (priority === "MEDIUM") return "gold";
  if (priority === "LOW") return "ok";
  return "neutral";
}

export function actionStatusTone(status: string, overdue = false): Tone {
  if (overdue) return "danger";
  if (status === "COMPLETED") return "ok";
  if (status === "BLOCKED") return "warn";
  if (status === "IN_PROGRESS") return "brand";
  if (status === "CANCELLED") return "neutral";
  if (status === "NOT_STARTED") return "gold";
  return "neutral";
}

export function qaResultTone(result: string): Tone {
  if (result === "PASSED") return "ok";
  if (result === "FAILED") return "danger";
  if (result === "PASSED_WITH_ISSUES") return "gold";
  if (result === "REQUIRES_RETEST") return "warn";
  return "neutral";
}

export function reportStatusTone(status: string): Tone {
  if (status === "REVIEWED") return "ok";
  if (status === "SUBMITTED") return "brand";
  if (status === "DRAFT") return "gold";
  return "neutral";
}

export function visitTone(recommendation: string): Tone {
  if (recommendation === "URGENT_VISIT") return "danger";
  if (recommendation === "VISIT_DUE") return "warn";
  if (recommendation === "VISIT_RECOMMENDED") return "gold";
  if (recommendation === "NOT_DUE") return "ok";
  return "neutral";
}

export function incidentStatusHex(status: string) {
  return TONE_HEX[incidentStatusTone(status)];
}

export function actionStatusHex(status: string, overdue = false) {
  return TONE_HEX[actionStatusTone(status, overdue)];
}

export function priorityHex(priority: string) {
  return TONE_HEX[priorityTone(priority)];
}

export function IncidentStatusPill({ status }: { status: string }) {
  return <TonePill tone={incidentStatusTone(status)}>{labelIncidentStatus(status)}</TonePill>;
}

export function PriorityPill({ priority }: { priority: string }) {
  return <TonePill tone={priorityTone(priority)}>{labelize(priority)}</TonePill>;
}

export function ActionStatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  return (
    <TonePill tone={actionStatusTone(status, overdue)}>
      {overdue ? "Overdue" : labelize(status)}
    </TonePill>
  );
}

export function QaResultPill({ result }: { result: QAResult | string }) {
  return <TonePill tone={qaResultTone(result)}>{labelize(result)}</TonePill>;
}

export function ReportStatusPill({ status }: { status: ReportStatus | string }) {
  return <TonePill tone={reportStatusTone(status)}>{labelize(status)}</TonePill>;
}

export function VisitPill({ recommendation }: { recommendation: VisitRecommendation | string }) {
  return <TonePill tone={visitTone(recommendation)}>{labelize(recommendation)}</TonePill>;
}
