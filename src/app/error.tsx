"use client";

import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-surface px-4 py-16 text-center">
      <BrandMark size={48} />
      <h1 className="font-heading mt-6 text-[24px] text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate">
        Beacon hit an unexpected error. Try again, or go back to the dashboard if this keeps happening.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[12px] text-slate">Ref {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="secondary">
          <a href="/dashboard">Dashboard</a>
        </Button>
      </div>
    </div>
  );
}
