"use client";

/**
 * Month + week calendar. Logging a visit POSTs /api/activities with type SITE_VISIT.
 * Event data is loaded in src/app/(dashboard)/calendar/page.tsx.
 *
 * Week grid: 07:00–19:00 timed blocks; actions without times sit in the all-day row.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

export type CalendarEvent = {
  id: string;
  kind: "visit" | "activity" | "action";
  title: string;
  facility: string;
  facilityId: string;
  at: string;
  end?: string | null;
  href: string;
  by: string;
};

const KIND_STYLE: Record<CalendarEvent["kind"], string> = {
  visit: "bg-[#e8b923]/20 text-[#854F0B] border-[#e8b923]/50 dark:text-[#f0c48a]",
  activity: "bg-brand/10 text-brand border-brand/20",
  action: "bg-status-critical-bg text-status-critical-fg border-transparent",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const HOUR_HEIGHT = 52;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeLabel(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function hours() {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index);
}

function isAllDay(event: CalendarEvent) {
  if (event.kind === "action") return true;
  const start = new Date(event.at);
  return start.getHours() === 0 && start.getMinutes() === 0 && !event.end;
}

function eventOffset(event: CalendarEvent) {
  const start = new Date(event.at);
  const minutes = start.getHours() * 60 + start.getMinutes() - DAY_START_HOUR * 60;
  return Math.max(0, minutes / 60) * HOUR_HEIGHT;
}

function eventHeight(event: CalendarEvent) {
  if (!event.end) return HOUR_HEIGHT;
  const hoursSpan = Math.max(
    0.5,
    (new Date(event.end).getTime() - new Date(event.at).getTime()) / 3_600_000,
  );
  return hoursSpan * HOUR_HEIGHT;
}

/** Google/Teams-style week: all-day row + hour grid. */
function WeekGrid({
  weekStart,
  byDay,
  onPickDay,
  onPickEvent,
}: {
  weekStart: Date;
  byDay: Map<string, CalendarEvent[]>;
  onPickDay: (day: string) => void;
  onPickEvent: (event: CalendarEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const today = isoDate(new Date());
  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="overflow-hidden rounded-[12px] border border-hairline bg-surface-raised">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-hairline">
        <div />
        {days.map((day) => {
          const key = isoDate(day);
          const isToday = key === today;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onPickDay(key)}
              className="border-l border-hairline px-2 py-3 text-left hover:bg-surface"
            >
              <p className="text-[12px] text-slate">{WEEKDAYS[day.getDay()]}</p>
              <span
                className={cn(
                  "mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full font-heading text-lg",
                  isToday && "bg-brand text-white",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-hairline">
        <div className="px-2 py-2 text-[11px] text-slate">All day</div>
        {days.map((day) => {
          const key = isoDate(day);
          const allDay = (byDay.get(key) || []).filter(isAllDay);
          return (
            <div key={key} className="min-h-12 space-y-1 border-l border-hairline p-1">
              {allDay.map((event) => (
                <button
                  type="button"
                  key={`${event.kind}-${event.id}`}
                  onClick={() => onPickEvent(event)}
                  className={cn(
                    "w-full truncate rounded-[6px] border px-1.5 py-0.5 text-left text-[11px]",
                    KIND_STYLE[event.kind],
                  )}
                >
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: gridHeight }}>
            {hours().map((hour) => (
              <div
                key={hour}
                className="absolute right-1 text-[11px] text-slate"
                style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT + 4 }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key = isoDate(day);
            const timed = (byDay.get(key) || []).filter((event) => !isAllDay(event));
            return (
              <button
                type="button"
                key={key}
                onClick={() => onPickDay(key)}
                className="relative border-l border-hairline"
                style={{ height: gridHeight }}
              >
                {hours().map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-hairline/80"
                    style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}
                {timed.map((event) => (
                  <span
                    key={`${event.kind}-${event.id}`}
                    role="link"
                    tabIndex={0}
                    onClick={(click) => {
                      click.stopPropagation();
                      onPickEvent(event);
                    }}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter") onPickEvent(event);
                    }}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-[8px] border px-1.5 py-1 text-left text-[11px]",
                      KIND_STYLE[event.kind],
                    )}
                    style={{
                      top: eventOffset(event),
                      height: eventHeight(event),
                    }}
                  >
                    <span className="block font-medium leading-tight">{event.title}</span>
                    <span className="block opacity-80">
                      {timeLabel(event.at)}
                      {event.end ? `–${timeLabel(event.end)}` : ""}
                    </span>
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarBoard({
  year,
  month,
  view,
  events,
  facilities,
  users,
  currentUserId,
  focusDay,
}: {
  year: number;
  month: number;
  view: "month" | "week";
  events: CalendarEvent[];
  facilities: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  focusDay?: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const days = useMemo(() => monthMatrix(year, month), [year, month]);
  const weekStart = useMemo(() => {
    const source = focusDay
      ? new Date(`${focusDay}T00:00:00`)
      : new Date(year, month, 1);
    return addDays(startOfDay(source), -source.getDay());
  }, [focusDay, year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = isoDate(new Date(event.at));
      map.set(key, [...(map.get(key) || []), event]);
    }
    return map;
  }, [events]);

  function monthQuery(date: Date, nextView = view, day?: string) {
    const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const params = new URLSearchParams({ month: monthValue, view: nextView });
    if (nextView === "week") params.set("day", day || isoDate(date));
    return `/calendar?${params.toString()}`;
  }

  function go(offset: number) {
    if (view === "week") {
      const next = addDays(weekStart, offset * 7);
      router.push(monthQuery(next, "week", isoDate(next)));
      return;
    }
    router.push(monthQuery(new Date(year, month + offset, 1), "month"));
  }

  async function logVisit(formData: FormData) {
    const date = String(formData.get("date"));
    const start = String(formData.get("startTime") || "09:00");
    const end = String(formData.get("endTime") || "12:00");
    try {
      await apiRequest("/api/activities", {
        facilityId: formData.get("facilityId"),
        type: "SITE_VISIT",
        date,
        startTime: `${date}T${start}:00`,
        endTime: `${date}T${end}:00`,
        responsibleUserId: formData.get("responsibleUserId"),
        description: formData.get("description"),
        findings: formData.get("findings") || null,
      });
      toast.success("Visit logged");
      setSelectedDate(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log visit");
    }
  }

  const title =
    view === "week"
      ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(weekStart)} – ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(addDays(weekStart, 6))}`
      : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
          new Date(year, month, 1),
        );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => go(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="font-heading min-w-40 text-[20px]">{title}</h2>
        <Button
          variant="secondary"
          onClick={() => router.push(monthQuery(new Date(), view, isoDate(new Date())))}
        >
          Today
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant={view === "month" ? "default" : "secondary"}
            onClick={() => router.push(monthQuery(new Date(year, month, 1), "month"))}
          >
            Month
          </Button>
          <Button
            variant={view === "week" ? "default" : "secondary"}
            onClick={() =>
              router.push(monthQuery(weekStart, "week", isoDate(weekStart)))
            }
          >
            Week
          </Button>
          <Button onClick={() => setSelectedDate(isoDate(new Date()))}>Log visit</Button>
        </div>
      </div>
      <ul className="mb-3 flex flex-wrap gap-4 text-[12px] text-slate">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e8b923]" /> Site visit
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Other activity
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#791F1F]" /> Action due
        </li>
      </ul>

      {view === "month" ? (
        <div className="overflow-hidden rounded-[12px] border border-hairline bg-surface-raised">
          <div className="grid grid-cols-7 border-b border-hairline bg-surface text-[12px] text-slate">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 font-medium">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = isoDate(day);
              const inMonth = day.getMonth() === month;
              const isToday = key === isoDate(new Date());
              const dayEvents = byDay.get(key) || [];
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    "min-h-28 border-b border-r border-hairline p-1.5 text-left align-top hover:bg-surface",
                    !inMonth && "bg-surface/60 text-slate",
                    isToday && "bg-brand/5",
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]",
                      isToday && "bg-brand text-white",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={`${event.kind}-${event.id}`}
                        role="link"
                        tabIndex={0}
                        onClick={(click) => {
                          click.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        onKeyDown={(keyEvent) => {
                          if (keyEvent.key === "Enter") setSelectedEvent(event);
                        }}
                        className={cn(
                          "block truncate rounded-[6px] border px-1.5 py-0.5 text-[11px]",
                          KIND_STYLE[event.kind],
                        )}
                      >
                        {event.kind === "visit" && timeLabel(event.at)
                          ? `${timeLabel(event.at)} ${event.title}`
                          : event.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="text-[11px] text-slate">+{dayEvents.length - 3} more</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <WeekGrid
          weekStart={weekStart}
          byDay={byDay}
          onPickDay={setSelectedDate}
          onPickEvent={setSelectedEvent}
        />
      )}

      {selectedDate ? (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[16px] border border-hairline bg-surface-raised p-5 shadow-xl">
            <h3 className="font-heading mb-1 text-[18px]">Log a site visit</h3>
            <p className="mb-4 text-[13px] text-slate">
              Visits appear on this calendar for the facility team. Pick a day, times, and who went.
            </p>
            <form action={logVisit} className="grid gap-3">
              <input type="hidden" name="date" value={selectedDate} />
              <div>
                <Label>Facility</Label>
                <Select name="facilityId" required>
                  {facilities.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Starts</Label>
                  <Input name="startTime" type="time" defaultValue="09:00" />
                </div>
                <div>
                  <Label>Ends</Label>
                  <Input name="endTime" type="time" defaultValue="12:00" />
                </div>
              </div>
              <div>
                <Label>Responsible</Label>
                <Select name="responsibleUserId" required defaultValue={currentUserId}>
                  {users.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>What was covered</Label>
                <Textarea name="description" required placeholder="Modules reviewed, people met, issues found..." />
              </div>
              <div>
                <Label>Findings (optional)</Label>
                <Textarea name="findings" />
              </div>
              <p className="text-[12px] text-slate">Visit date: {selectedDate}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setSelectedDate(null)}>
                  Cancel
                </Button>
                <Button>Save visit</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[16px] border border-hairline bg-surface-raised p-5">
            <p className="text-[12px] uppercase tracking-wide text-slate">{selectedEvent.kind}</p>
            <h3 className="font-heading mt-1 text-[18px]">{selectedEvent.title}</h3>
            <p className="mt-2 text-sm">
              {selectedEvent.facility}
              {timeLabel(selectedEvent.at) ? ` · ${timeLabel(selectedEvent.at)}` : ""}
            </p>
            <p className="text-[13px] text-slate">{selectedEvent.by}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
              <Button asChild>
                <Link
                  href={
                    selectedEvent.kind === "action"
                      ? `/actions?facilityId=${encodeURIComponent(selectedEvent.facilityId)}`
                      : `/facilities/${encodeURIComponent(selectedEvent.facilityId)}`
                  }
                >
                  Open
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
