"use client";

/** Incident create/update forms used on /incidents and /incidents/[id]. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { IncidentStatusSelect } from "@/components/ui/incident-status-select";
import { toast } from "sonner";
import { apiRequest } from "@/components/forms";
import { incidentStatusOptions } from "@/lib/incident-status";
import { Plus, Upload } from "lucide-react";

type FacilityOption = {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
};

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function IncidentForm({
  facilities,
  users,
  defaultFacilityId,
  canClose,
  canAssign = false,
}: {
  facilities: FacilityOption[];
  users: { id: string; name: string }[];
  defaultFacilityId?: string;
  canClose: boolean;
  canAssign?: boolean;
}) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState(
    defaultFacilityId || facilities[0]?.id || "",
  );
  const branches = useMemo(
    () => facilities.find((row) => row.id === facilityId)?.branches || [],
    [facilities, facilityId],
  );
  const statuses = incidentStatusOptions(canClose);

  async function onSubmit(formData: FormData) {
    try {
      await apiRequest("/api/incidents", {
        facilityId: formData.get("facilityId"),
        branchId: formData.get("branchId") || null,
        description: formData.get("description"),
        status: formData.get("status"),
        reportedAt: formData.get("reportedAt"),
        priority: formData.get("priority") || "MEDIUM",
        assigneeId: canAssign ? formData.get("assigneeId") || null : null,
        dueDate: formData.get("dueDate") || null,
      });
      toast.success("Incident created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label>Incident</Label>
        <Textarea name="description" required placeholder="What happened" />
      </div>
      <div>
        <Label>Status</Label>
        <IncidentStatusSelect
          name="status"
          options={statuses}
          defaultValue="NEW"
          size="md"
          aria-label="Status"
        />
      </div>
      <div>
        <Label>Date reported</Label>
        <Input name="reportedAt" type="date" required defaultValue={todayIso()} />
      </div>
      <div>
        <Label>Facility</Label>
        <Select
          name="facilityId"
          required
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
        >
          {facilities.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Branch (optional)</Label>
        <Select name="branchId">
          <option value="">Whole facility</option>
          {branches.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Priority (optional)</Label>
        <Select name="priority" defaultValue="MEDIUM">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </Select>
      </div>
      {canAssign ? (
        <div>
          <Label>Assignee (optional)</Label>
          <Select name="assigneeId">
            <option value="">Unassigned</option>
            {users.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <Label>Due date (optional)</Label>
        <Input name="dueDate" type="date" />
      </div>
      <div className="md:col-span-2">
        <Button>
          <Plus className="h-4 w-4" />
          Create incident
        </Button>
      </div>
    </form>
  );
}

export function IncidentImportForm({
  facilityId,
  facilities,
}: {
  facilityId?: string;
  facilities?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState(facilityId || "");
  const scopedId = facilityId || selectedFacilityId;

  async function onSubmit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose an Excel file first");
      return;
    }
    if (!scopedId) {
      toast.error("Choose a facility before uploading");
      return;
    }
    formData.set("facilityId", scopedId);
    setPending(true);
    try {
      const res = await fetch("/api/incidents/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Session expired. Sign in again.");
      if (!res.ok) throw new Error(data.error || "Import failed");
      const failed = Array.isArray(data.failed) ? data.failed.length : 0;
      toast.success(
        `Imported ${data.created} incident${data.created === 1 ? "" : "s"}${failed ? `, ${failed} row(s) skipped` : ""}`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <p className="text-[13px] text-slate">
        Choose the facility here so names in Excel cannot be mistyped. Columns: Incident, Status,
        DateReported. Optional: Branch, Priority, AssigneeEmail, DueDate.
      </p>
      {!facilityId && facilities ? (
        <div>
          <Label>Facility</Label>
          <Select
            required
            value={selectedFacilityId}
            onChange={(event) => setSelectedFacilityId(event.target.value)}
          >
            <option value="">Select facility</option>
            {facilities.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="incident-import">Excel workbook (.xlsx)</Label>
        <Input
          id="incident-import"
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending}>
          <Upload className="h-4 w-4" />
          {pending ? "Importing..." : "Upload incidents"}
        </Button>
        <Button asChild variant="secondary">
          <a href={scopedId ? `/api/incidents/import/template?facilityId=${scopedId}` : "/api/incidents/import/template"}>
            Download template
          </a>
        </Button>
      </div>
    </form>
  );
}
