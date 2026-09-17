/** Raised surface card. */
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
        "rounded-2xl border border-hairline bg-surface-raised shadow-[0_1px_0_rgba(28,36,48,0.04)]",
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
        "h-full p-4",
        href &&
          "transition-[transform,border-color,box-shadow] duration-[200ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_8px_24px_rgba(12,24,48,0.06)]",
      )}
    >      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] leading-snug text-slate">{label}</p>
        {Icon ? (
          <span className="rounded-xl bg-brand/10 p-2 text-brand">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="font-heading mt-2 text-[22px] leading-none text-ink lg:text-[26px]">{value}</p>
    </Card>
  );
  if (!href) return inner;
  return (
    <a href={href} className="block no-underline">
      {inner}
    </a>
  );
}
