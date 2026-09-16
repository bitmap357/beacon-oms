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
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
          "fixed inset-y-0 left-0 z-40 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-hairline bg-surface-raised p-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-transform lg:w-72",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-3 px-1">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
            <BrandMark size={44} />
            <div className="min-w-0">
              <p className="font-heading text-[18px] text-ink">Beacon</p>
              <p className="text-[12px] text-slate">Operations desk</p>
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
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {[...NAV, ...adminNav].map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] lg:min-h-10 lg:py-2 lg:text-[14px]",
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
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-hairline bg-surface-raised/95 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur sm:gap-3 sm:px-4 sm:py-3 lg:gap-4 lg:px-8">
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
              className="h-11 w-full rounded-xl border border-hairline bg-surface px-4 pl-10 text-base text-ink shadow-[inset_0_1px_2px_rgba(28,36,48,0.04)] placeholder:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-10 md:text-[15px]"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
            <ThemeToggle />
            <Link
              href="/notifications"
              className="relative rounded-xl p-2.5 hover:bg-surface"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />
              ) : null}
            </Link>
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
        </header>
        <main className="min-w-0 flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
