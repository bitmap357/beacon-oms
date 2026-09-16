/** Lighthouse mark: public/brand/mark.png (platform icon, outer black square removed). Favicon: src/app/icon.png */
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
        src="/brand/mark.png"
        alt="Beacon"
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/** Full lockup: pin + Beacon + tagline from public/brand/lockup.png */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/lockup.png"
        alt="Beacon Operations Management System"
        className="h-auto w-full object-contain"
      />
    </span>
  );
}
