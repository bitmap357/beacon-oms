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
    <div className="rounded-2xl border border-hairline bg-surface-raised px-6 py-12 text-center">
      <p className="text-[15px] text-slate">{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  illustration,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  illustration?: string;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-hairline bg-surface-raised md:mb-6">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:px-5 md:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {illustration ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={illustration}
              alt=""
              className="h-14 w-14 shrink-0 object-contain sm:h-20 sm:w-20 md:h-28 md:w-28"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="font-heading break-words text-[22px] leading-tight text-ink md:text-[28px]">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-[13px] text-slate md:text-[14px]">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="w-full shrink-0 sm:w-auto">{actions}</div> : null}
      </div>
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
      <p className="text-[14px] text-slate">{label}</p>
      {children}
    </div>
  );
}
