/** Beacon lighthouse loader and page skeletons used by route loading.tsx files. */
import { BrandMark } from "@/components/brand";
import { cn } from "@/lib/utils";

export function BeaconLoader({
  label,
  size = 56,
  className,
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="beacon-ring pointer-events-none absolute inset-[-38%] rounded-full border border-[#e8b923]/50" />
        <span className="beacon-ring beacon-ring-delay pointer-events-none absolute inset-[-18%] rounded-full border border-[#1558d6]/40" />
        <span
          className="beacon-sweep pointer-events-none absolute inset-[-10%] rounded-full border-t-2 border-gold"
          aria-hidden
        />
        <BrandMark size={size} className="relative z-10" />
      </span>
      {label ? <p className="text-sm text-slate">{label}</p> : <span className="sr-only">Loading Beacon</span>}
    </div>
  );
}

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-lg bg-muted", className)} />;
}

export function PageSkeleton({
  variant = "table",
}: {
  variant?: "table" | "dashboard" | "calendar";
}) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <section className="mb-6 overflow-hidden rounded-2xl border border-hairline bg-surface-raised lg:mb-8">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)]">
          <div className="flex min-w-0 flex-col justify-center px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
            <Bone className="h-8 w-48 sm:h-9 sm:w-60" />
            <Bone className="mt-3 h-4 w-full max-w-md" />
            <Bone className="mt-2 h-4 w-2/3 max-w-sm" />
          </div>
          <div className="flex min-h-[11rem] items-center justify-center bg-[#f3eee4] sm:min-h-[12rem] dark:bg-[#10192c]">
            <BeaconLoader size={72} />
          </div>
        </div>
      </section>
      {variant === "dashboard" ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Bone key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Bone className="h-64 rounded-2xl xl:col-span-2" />
            <Bone className="h-64 rounded-2xl" />
          </div>
        </>
      ) : null}
      {variant === "calendar" ? (
        <>
          <Bone className="mb-4 h-12 w-full rounded-2xl" />
          <Bone className="h-[28rem] w-full rounded-2xl" />
        </>
      ) : null}
      {variant === "table" ? (
        <>
          <Bone className="mb-4 h-24 w-full rounded-2xl" />
          <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-raised p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Bone key={index} className={cn("h-10 w-full", index > 0 && "mt-3")} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Back-compat alias for login and other compact fallbacks. */
export function PageLoader({ label = "Loading Beacon" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <BeaconLoader label={label} size={64} />
    </div>
  );
}
