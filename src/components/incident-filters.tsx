"use client";

/** Status / priority / without-actions filters for the incident inbox. */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label, Select } from "@/components/ui/input";
import { INCIDENT_STATUSES } from "@/lib/incident-status";
import { labelize } from "@/lib/utils";

export function IncidentFilters() {
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

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div className="min-w-0 sm:min-w-40">
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
              {labelize(status)}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-0 sm:min-w-36">
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
      <label className="mb-1 flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand"
          checked={params.get("withoutActions") === "1"}
          onChange={(event) => setParam("withoutActions", event.target.checked ? "1" : "")}
        />
        Without actions
      </label>
    </div>
  );
}
