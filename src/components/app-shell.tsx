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
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col overflow-y-auto border-r border-hairline bg-surface-raised p-5 transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-1">
          <BrandMark size={44} />
          <div>
            <p className="font-heading text-[18px] text-ink">Beacon</p>
            <p className="text-[12px] text-slate">Operations desk</p>
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
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]",
                  active
                    ? "bg-brand/10 text-brand-deep shadow-[inset_3px_0_0_0_var(--gold)]"
                    : "text-ink hover:bg-surface",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
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
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-hairline bg-surface-raised/95 px-4 py-3 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <form action="/search" className="relative min-w-0 max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate" />
            <input
              name="q"
              placeholder="Search facilities, incidents, people..."
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-4 pl-10 text-[15px] text-ink shadow-[inset_0_1px_2px_rgba(28,36,48,0.04)] placeholder:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link href="/notifications" className="relative rounded-xl p-2.5 hover:bg-surface">
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />
              ) : null}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-[15px] text-ink">{user.name}</p>
              <p className="text-[12px] text-slate">{formatRole(user.role)}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="secondary" size="icon" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
