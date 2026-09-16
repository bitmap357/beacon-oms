import Link from "next/link";
import type { Metadata } from "next";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16 text-center">
      <BrandMark size={56} />
      <p className="mt-6 text-[13px] font-medium uppercase tracking-wide text-slate">404</p>
      <h1 className="font-heading mt-2 text-[28px] text-ink">This page is not on the map</h1>
      <p className="mt-2 max-w-md text-sm text-slate">
        The link may be out of date, or you might not have access to that record. Head back to the
        operations desk and search from there.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/illustrations/empty-work.png"
        alt="Empty operations desk illustration"
        className="mt-8 h-32 w-32 object-contain"
      />
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/search">Search</Link>
        </Button>
      </div>
    </div>
  );
}
