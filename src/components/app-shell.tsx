"use client";

/**
 * Logged-in chrome: left nav, search, theme, notifications, name/role (top-right), sign out.
 * Add a page: put a row in NAV (or adminNav). Role label: formatRole in src/lib/utils.ts.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Shield,
  Siren,
  Users,
  BarChart3,
  ArrowLeftRight,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn, formatRole } from "@/lib/utils";
import type { UserRole } from "@/lib/db-types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/actions", label: "Actions", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/qa", label: "QA", icon: Activity },
  { href: "/handovers", label: "Handovers", icon: ArrowLeftRight },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AppShell({
  children,
  user,
  unread,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: UserRole };
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const adminNav =
    user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/organizations", label: "Organizations", icon: Building2 },
          { href: "/audit", label: "Audit trail", icon: Shield },
        ]
      : user.role === "MANAGEMENT"
        ? [
            { href: "/admin/users", label: "Users", icon: Users },
            { href: "/admin/organizations", label: "Organizations", icon: Building2 },
          ]
        : [];

  return (
    <div className="min-h-screen bg-surface">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-60 flex-col overflow-y-auto border-r border-hairline bg-surface-raised p-4 transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-1">
          <BrandMark size={40} />
          <div>
            <p className="font-heading text-base text-ink">Beacon</p>
            <p className="text-[11px] text-slate">Operations management</p>
          </div>
        </Link>
        <nav className="space-y-1">
          {[...NAV, ...adminNav].map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm",
                  active
                    ? "bg-brand text-white"
                    : "text-ink hover:bg-surface",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      {open ? (
        <button
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-hairline bg-surface-raised px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <form action="/search" className="relative min-w-0 max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate" />
            <input
              name="q"
              placeholder="Search facilities, incidents, people..."
              className="h-9 w-full rounded-[10px] border border-hairline bg-surface pl-9 pr-3 text-sm text-ink"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link href="/notifications" className="relative rounded-[10px] p-2 hover:bg-surface">
              <Bell className="h-4 w-4" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand" />
              ) : null}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm text-ink">{user.name}</p>
              <p className="text-[11px] text-slate">{formatRole(user.role)}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="secondary" size="icon" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
