/** PageHeader + EmptyState used at the top of dashboard screens. */
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-hairline bg-surface-raised px-5 py-10 text-center">
      <p className="text-sm text-slate">{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-[24px] text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 text-[13px] text-slate">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[13px] text-slate">{label}</p>
      {children}
    </div>
  );
}
