import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[13px] font-medium uppercase tracking-wide text-slate">404</p>
      <h1 className="font-heading mt-2 text-[24px] text-ink">We could not find that record</h1>
      <p className="mt-2 max-w-md text-sm text-slate">
        It may have been removed, or you might not have access. Search from the header or go back to
        the dashboard.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/search">Search</Link>
        </Button>
      </div>
    </div>
  );
}
