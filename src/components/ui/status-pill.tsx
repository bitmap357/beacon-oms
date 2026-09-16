/** Status and priority colour pills. Facility health uses StatusPill; work items use TonePill helpers. */
import type { FacilityHealth } from "@/lib/db-types";
import { canonicalIncidentStatus, labelIncidentStatus } from "@/lib/incident-status";
import { cn, labelize } from "@/lib/utils";

const STATUS_STYLES: Record<FacilityHealth, string> = {
  HEALTHY: "bg-status-healthy-bg text-status-healthy-fg",
  ATTENTION_REQUIRED: "bg-status-attention-bg text-status-attention-fg",
  AT_RISK: "bg-status-atrisk-bg text-status-atrisk-fg",
  CRITICAL: "bg-status-critical-bg text-status-critical-fg",
  INACTIVE: "bg-status-inactive-bg text-status-inactive-fg",
};

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
        "inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium",
        style ?? "bg-muted text-slate",
        className,
      )}
    >
      {labelize(status)}
    </span>
  );
}

export type Tone = "neutral" | "danger" | "warn" | "ok" | "gold" | "brand";

export function TonePill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const styles: Record<Tone, string> = {
    neutral: "bg-muted text-slate",
    danger: "bg-status-critical-bg text-status-critical-fg",
    warn: "bg-status-attention-bg text-status-attention-fg",
    ok: "bg-status-healthy-bg text-status-healthy-fg",
    gold: "bg-[#f8efd0] text-[#8a6a12] dark:bg-[#32280f] dark:text-[#f0c48a]",
    brand: "bg-accent text-brand-deep",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function incidentStatusTone(status: string): Tone {
  const canonical = String(canonicalIncidentStatus(status));
  if (canonical === "IN_PROGRESS") return "brand";
  if (canonical === "ON_HOLD" || canonical === "REOPENED") return "warn";
  if (canonical === "COMPLETED") return "gold";
  if (canonical === "CLOSED") return "ok";
  return "neutral";
}

export function priorityTone(priority: string): Tone {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "warn";
  if (priority === "MEDIUM") return "gold";
  return "ok";
}

export function actionStatusTone(status: string, overdue = false): Tone {
  if (overdue) return "danger";
  if (status === "COMPLETED") return "ok";
  if (status === "BLOCKED") return "warn";
  if (status === "IN_PROGRESS") return "brand";
  if (status === "CANCELLED") return "neutral";
  return "gold";
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
