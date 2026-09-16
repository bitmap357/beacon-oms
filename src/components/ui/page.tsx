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
    <section className="mb-6 overflow-hidden rounded-2xl border border-hairline bg-surface-raised lg:mb-8">
      <div
        className={cn(
          "grid",
          illustration &&
            "lg:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)] xl:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]",
        )}
      >
        <div className="flex min-w-0 flex-col justify-center px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
          <h1 className="font-heading min-w-0 text-[26px] leading-[1.2] text-ink sm:text-[30px] lg:text-[34px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate md:text-[15px]">
              {description}
            </p>
          ) : null}
          {actions ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {illustration ? (
          <div className="relative h-44 min-h-[11rem] bg-[#f3eee4] sm:h-48 lg:h-auto lg:min-h-[16rem] xl:min-h-[17rem] dark:bg-[#10192c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={illustration}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-contain object-center p-3 sm:p-4"
            />
          </div>
        ) : null}
      </div>
    </section>
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
