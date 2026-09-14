/** Facility health colours. Status strings: src/lib/db-types.ts FacilityHealth. */
import type { FacilityHealth } from "@/lib/db-types";
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
        "inline-flex rounded-[20px] px-[10px] py-[3px] text-[12px] font-medium",
        style ?? "bg-muted text-slate",
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
  tone?: "neutral" | "danger" | "warn" | "ok";
}) {
  const styles = {
    neutral: "bg-muted text-slate",
    danger: "bg-status-critical-bg text-status-critical-fg",
    warn: "bg-status-attention-bg text-status-attention-fg",
    ok: "bg-status-healthy-bg text-status-healthy-fg",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-[20px] px-[10px] py-[3px] text-[12px] font-medium",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}
