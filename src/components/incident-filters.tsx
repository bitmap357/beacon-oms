"use client";

/** Status / facility / date / assignee filters plus Excel export for the incident inbox. */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { INCIDENT_STATUSES, labelIncidentStatus } from "@/lib/incident-status";
import { labelize } from "@/lib/utils";

export function IncidentFilters({
  facilities,
  users,
}: {
  facilities: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const exportHref = `/api/incidents/export${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-raised p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
        <div className="min-w-0 lg:w-48">
          <Label>Facility</Label>
          <Select
            value={params.get("facilityId") || ""}
            onChange={(event) => setParam("facilityId", event.target.value)}
            aria-label="Filter by facility"
          >
            <option value="">All facilities</option>
            {facilities.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 lg:w-44">
          <Label>Status</Label>
          <Select
            value={params.get("status") || ""}
            onChange={(event) => setParam("status", event.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelIncidentStatus(status)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 lg:w-40">
          <Label>Priority</Label>
          <Select
            value={params.get("priority") || ""}
            onChange={(event) => setParam("priority", event.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All</option>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => (
              <option key={priority} value={priority}>
                {labelize(priority)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 lg:w-48">
          <Label>Assignee</Label>
          <Select
            value={params.get("assigneeId") || ""}
            onChange={(event) => setParam("assigneeId", event.target.value)}
            aria-label="Filter by assignee"
          >
            <option value="">Anyone</option>
            {users.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 lg:w-40">
          <Label>From</Label>
          <Input
            type="date"
            value={params.get("from") || ""}
            onChange={(event) => setParam("from", event.target.value)}
            aria-label="Filter from date"
          />
        </div>
        <div className="min-w-0 lg:w-40">
          <Label>To</Label>
          <Input
            type="date"
            value={params.get("to") || ""}
            onChange={(event) => setParam("to", event.target.value)}
            aria-label="Filter to date"
          />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm lg:mb-1">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={params.get("withoutActions") === "1"}
            onChange={(event) => setParam("withoutActions", event.target.checked ? "1" : "")}
          />
          Without actions
        </label>
        <Button asChild variant="secondary" className="lg:mb-0.5">
          <a href={exportHref}>
            <Download className="h-4 w-4" />
            Export
          </a>
        </Button>
      </div>
    </div>
  );
}
