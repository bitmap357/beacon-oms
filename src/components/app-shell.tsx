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
  X,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn, formatRole } from "@/lib/utils";
import type { UserRole } from "@/lib/db-types";
import { hasPermission, type Permission } from "@/lib/permissions";

const NAV: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/facilities", label: "Facilities", icon: Building2 },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/actions", label: "Actions", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/qa", label: "QA", icon: Activity, permission: "qa.manage" },
  { href: "/handovers", label: "Handovers", icon: ArrowLeftRight, permission: "handovers.manage" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.view" },
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
          { href: "/admin/settings", label: "Settings", icon: Settings2 },
          { href: "/audit", label: "Audit trail", icon: Shield },
        ]
      : user.role === "MANAGEMENT"
        ? [
            { href: "/admin/users", label: "Users", icon: Users },
            { href: "/admin/organizations", label: "Organizations", icon: Building2 },
            { href: "/admin/settings", label: "Settings", icon: Settings2 },
          ]
        : [];

  const navItems = [
    ...NAV.filter(
      (item) => !item.permission || hasPermission(user.role, item.permission),
    ),
    ...adminNav,
  ];

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-surface">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[min(14rem,calc(100vw-2.5rem))] flex-col border-r border-hairline bg-surface-raised p-3 pt-[max(1rem,env(safe-area-inset-top))] transition-transform duration-[var(--motion-duration)] ease-[var(--motion-ease-out)] lg:w-52",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
            <BrandMark size={36} />
            <div className="min-w-0">
              <p className="font-heading text-[16px] text-ink">Beacon</p>
              <p className="text-[11px] text-slate">Operations</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Breadcrumbs
          className="mb-3 flex flex-wrap gap-y-0.5 border-b border-hairline px-1 pb-3 text-[11px]"
          onNavigate={() => setOpen(false)}
        />
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-[background-color,color,box-shadow,transform] duration-[var(--motion-duration)] ease-[var(--motion-ease-out)] active:scale-[0.99] lg:min-h-9 lg:py-1.5 lg:text-[13px]",
                  active
                    ? "bg-brand/10 text-brand-deep shadow-[inset_3px_0_0_0_var(--gold)]"
                    : "text-ink hover:bg-surface",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-hairline pt-4 lg:hidden">
          <p className="truncate text-[15px] text-ink">{user.name}</p>
          <p className="text-[12px] text-slate">{formatRole(user.role)}</p>
        </div>
      </aside>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-52">
        <header className="sticky top-0 z-20 flex flex-col gap-1.5 border-b border-hairline bg-surface-raised/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur sm:px-4 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <form action="/search" className="relative min-w-0 flex-1 lg:min-w-[16rem] lg:max-w-md xl:max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              name="q"
              placeholder="Search…"
              aria-label="Search facilities, incidents, people"
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-4 pl-10 text-base text-ink shadow-[inset_0_1px_2px_rgba(28,36,48,0.03)] placeholder:text-slate/80 transition-[border-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)] hover:border-brand/30 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/35 md:h-10 md:text-[14px]"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
            <ThemeToggle />
            <NotificationBell unread={unread} />
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-[14px] text-ink">{user.name}</p>
              <p className="text-[12px] text-slate">{formatRole(user.role)}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="secondary" size="icon" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-5 lg:px-6 lg:py-5">{children}</main>
      </div>
    </div>
  );
}
