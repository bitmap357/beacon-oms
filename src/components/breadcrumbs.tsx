"use client";

/** Compact path trail in the sidebar — derived from the current URL. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  facilities: "Facilities",
  incidents: "Incidents",
  actions: "Actions",
  reports: "Reports",
  qa: "QA",
  handovers: "Handovers",
  calendar: "Calendar",
  analytics: "Analytics",
  admin: "Admin",
  users: "Users",
  organizations: "Organizations",
  audit: "Audit trail",
  search: "Search",
  notifications: "Notifications",
  settings: "Settings",
};

function labelFor(segment: string, index: number, parts: string[]) {
  if (LABELS[segment]) return LABELS[segment];
  if (parts[index - 1] === "facilities" || parts[index - 1] === "incidents") {
    return "Detail";
  }
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Breadcrumbs({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() || "/";
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const crumbs = parts.map((segment, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    const label = labelFor(segment, index, parts);
    const last = index === parts.length - 1;
    return { href, label, last };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-x-auto text-[12px] text-slate",
        className,
      )}
    >
      <Link href="/dashboard" className="shrink-0 hover:text-brand" onClick={onNavigate}>
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
          {crumb.last ? (
            <span className="truncate font-medium text-ink" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="truncate hover:text-brand" onClick={onNavigate}>
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
