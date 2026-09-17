"use client";

/**
 * Header notification bell with a quick-view panel.
 * Escape / outside click close; Tab cycles inside the panel.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "@/components/forms";
import { cn, formatDateTime, labelize } from "@/lib/utils";
import { toast } from "sonner";

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedType: string | null;
  relatedId: string | null;
};

function relatedHref(row: NotificationRow) {
  if (!row.relatedType || !row.relatedId) return "/notifications";
  switch (row.relatedType) {
    case "Incident":
      return `/incidents/${row.relatedId}`;
    case "Action":
      return `/actions?highlight=${row.relatedId}`;
    case "Report":
      return `/reports/${row.relatedId}`;
    case "Facility":
      return `/facilities/${row.relatedId}`;
    case "Handover":
      return `/handovers?highlight=${row.relatedId}`;
    case "QARecord":
      return `/qa?highlight=${row.relatedId}`;
    default:
      return "/notifications";
  }
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateTime(value);
  const mins = Math.round((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(value);
}

export function NotificationBell({ unread: initialUnread }: { unread: number }) {
  const router = useRouter();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        notifications: NotificationRow[];
        unreadCount: number;
      }>("/api/notifications?limit=8", undefined, "GET");
      setRows(data.notifications);
      setUnread(data.unreadCount);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load notifications");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await apiRequest<{
        notifications: NotificationRow[];
        unreadCount: number;
      }>("/api/notifications?limit=1", undefined, "GET");
      setUnread(data.unreadCount);
      if (open) setRows(data.notifications.length ? data.notifications : null);
    } catch {
      // Keep the last known badge; next open/focus retries.
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === "visible") void refreshUnread();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshUnread();
    }, 90_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [refreshUnread]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      first?.focus();
    }, 0);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, close]);

  async function markRead(id: string) {
    try {
      await apiRequest(`/api/notifications/${id}/read`, undefined, "PATCH");
      setRows((prev) =>
        prev?.map((row) => (row.id === id ? { ...row, isRead: true } : row)) ?? null,
      );
      setUnread((count) => Math.max(0, count - 1));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark read");
    }
  }

  const badgeLabel =
    unread > 9 ? "9+" : unread > 0 ? String(unread) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "relative rounded-xl p-2.5 text-ink transition-[background-color,color] duration-[180ms] hover:bg-surface",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          open && "bg-surface",
        )}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {badgeLabel ? (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-none text-[#1c2430]"
            aria-hidden
          >
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Recent notifications"
          className="notification-panel absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-hairline bg-surface-raised shadow-[0_12px_40px_rgba(12,24,48,0.14)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div>
              <p className="font-heading text-[15px] text-ink">Notifications</p>
              <p className="text-[12px] text-slate">
                {unread > 0 ? `${unread} unread` : "You're up to date"}
              </p>
            </div>
            <Link
              href="/notifications"
              className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {loading && !rows ? (
              <div className="space-y-3 px-4 py-4" aria-busy="true" aria-live="polite">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : rows && rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-slate">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {(rows ?? []).map((row) => (
                  <li key={row.id} className={cn(!row.isRead && "bg-brand/[0.04]")}>
                    <div className="flex gap-2 px-3 py-3">
                      <Link
                        href={relatedHref(row)}
                        className="min-w-0 flex-1 rounded-lg px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-[14px] leading-snug text-ink">{row.message}</p>
                        <p className="mt-1 text-[11px] text-slate">
                          {labelize(row.type)} · {formatRelative(row.createdAt)}
                          {!row.isRead ? " · Unread" : ""}
                        </p>
                      </Link>
                      {!row.isRead ? (
                        <button
                          type="button"
                          className="shrink-0 self-start rounded-lg px-2 py-1 text-[12px] font-medium text-brand transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          onClick={() => void markRead(row.id)}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-hairline bg-surface/60 px-4 py-3">
            <Link
              href="/notifications"
              className="flex min-h-10 items-center justify-center rounded-xl bg-brand px-3 text-[14px] font-medium text-white transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              onClick={() => setOpen(false)}
            >
              Open notifications inbox
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
