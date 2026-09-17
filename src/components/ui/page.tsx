/** PageHeader used at the top of dashboard screens. */
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <section className="page-enter mb-5 overflow-hidden rounded-2xl border border-hairline bg-surface-raised shadow-[0_1px_0_rgba(28,36,48,0.04)] lg:mb-6">
      <div
        className={cn(
          "grid",
          illustration &&
            "lg:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)] xl:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]",
        )}
      >
        <div className="flex min-w-0 flex-col justify-center px-5 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6">
          <h1 className="font-heading min-w-0 text-[24px] leading-[1.15] tracking-tight text-ink sm:text-[28px] lg:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate md:text-[14px]">
              {description}
            </p>
          ) : null}
          {actions ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {illustration ? (
          <div className="relative h-40 min-h-[10rem] bg-[#f3eee4] sm:h-44 lg:h-auto lg:min-h-[14rem] xl:min-h-[15rem] dark:bg-[#10192c]">
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
      className={cn(
        "group mb-5 rounded-2xl border border-hairline bg-surface-raised p-4 shadow-[0_1px_0_rgba(28,36,48,0.04)] sm:p-5",
        className,
      )}
      open={defaultOpen || undefined}
    >
      <summary className="font-heading flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] tracking-tight md:text-[17px] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate transition-transform duration-[var(--motion-duration)] ease-[var(--motion-ease-out)] group-open:rotate-180" />
      </summary>
      <div className="mt-3.5">{children}</div>
    </details>
  );
}
