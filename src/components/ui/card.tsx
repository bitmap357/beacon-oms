/** Raised surface card and metric tiles — ops desk, not default dashboard chrome. */
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  tint,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tint?: "navy" | "gold" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-surface-raised shadow-[0_1px_0_rgba(28,36,48,0.04),0_8px_24px_rgba(12,24,48,0.03)]",
        tint === "navy" && "border-l-[3px] border-l-brand",
        tint === "gold" && "border-l-[3px] border-l-gold",
        className,
      )}
      {...props}
    />
  );
}

export function MetricCard({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  href?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  const inner = (
    <Card
      className={cn(
        "h-full px-4 py-3.5 sm:px-5 sm:py-4",
        href &&
          "transition-[border-color,box-shadow,transform] duration-[var(--motion-duration)] ease-[var(--motion-ease-out)] hover:border-brand/40 hover:shadow-[0_1px_0_rgba(28,36,48,0.04),0_10px_28px_rgba(12,24,48,0.06)] hover:-translate-y-px active:translate-y-0 active:scale-[0.99]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate">
          {label}
        </p>
        {Icon ? (
          <span className="rounded-lg bg-brand/[0.08] p-1.5 text-brand transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <p className="font-heading mt-2.5 text-[22px] leading-none tracking-tight text-ink lg:text-[24px]">
        {value}
      </p>
    </Card>
  );
  if (!href) return inner;
  return (
    <a href={href} className="block no-underline">
      {inner}
    </a>
  );
}
