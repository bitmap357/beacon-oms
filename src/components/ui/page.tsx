/** PageHeader + EmptyState used at the top of dashboard screens. */
import { ChevronDown } from "lucide-react";
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
    <div className="mb-6 border-b border-hairline pb-5 lg:mb-8 lg:pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          {illustration ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={illustration}
              alt=""
              aria-hidden
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="font-heading text-[22px] leading-tight text-ink lg:text-[28px]">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-[13px] leading-snug text-slate md:text-[14px]">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function CollapsibleSection({
  title,
  children,
  className,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className={cn("group mb-6 rounded-2xl border border-hairline bg-surface-raised p-5", className)}
      open={defaultOpen || undefined}
    >
      <summary className="font-heading flex cursor-pointer list-none items-center justify-between gap-3 text-[16px] md:text-[18px] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
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
