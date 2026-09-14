/** Lighthouse mark. File: public/brand/mark.svg (transparent). Favicon: src/app/icon.svg */
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mark.svg"
        alt="Beacon"
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark size={48} />
      <div>
        <p className="font-heading text-2xl leading-none text-ink">Beacon</p>
        <p className="mt-1 text-[12px] tracking-wide text-slate">
          Operations Management System
        </p>
      </div>
    </div>
  );
}
