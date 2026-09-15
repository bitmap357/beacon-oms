"use client";

/** Incident create/update forms used on /incidents and /incidents/[id]. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { toast } from "sonner";
import { apiRequest } from "@/components/forms";

type FacilityOption = {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
};

export function IncidentForm({
  facilities,
  users,
  defaultFacilityId,
}: {
  facilities: FacilityOption[];
  users: { id: string; name: string }[];
  defaultFacilityId?: string;
}) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState(
    defaultFacilityId || facilities[0]?.id || "",
  );
  const branches = useMemo(
    () => facilities.find((row) => row.id === facilityId)?.branches || [],
    [facilities, facilityId],
  );

  async function onSubmit(formData: FormData) {
    try {
      await apiRequest("/api/incidents", {
        facilityId: formData.get("facilityId"),
        branchId: formData.get("branchId") || null,
        priority: formData.get("priority"),
        assigneeId: formData.get("assigneeId") || null,
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
        <Label>Priority</Label>
        <Select name="priority" required defaultValue="MEDIUM">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </Select>
      </div>
      <div>
        <Label>Assignee</Label>
        <Select name="assigneeId">
          <option value="">Unassigned</option>
          {users.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Due date</Label>
        <Input name="dueDate" type="date" />
      </div>
      <div className="md:col-span-2">
        <Button>Create incident</Button>
      </div>
    </form>
  );
}

export function IncidentImportForm({ facilityId }: { facilityId?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose an Excel file first");
      return;
    }
    if (facilityId) formData.set("facilityId", facilityId);
    setPending(true);
    try {
      const res = await fetch("/api/incidents/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
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
        {facilityId
          ? "Columns: Branch, Priority, AssigneeEmail, DueDate. Facility is this site."
          : "Columns: Facility, Branch, Priority, AssigneeEmail, DueDate. Download the template if you need the exact headings."}
      </p>
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
        <Button disabled={pending}>{pending ? "Importing..." : "Upload incidents"}</Button>
        <Button asChild variant="secondary">
          <a href={facilityId ? `/api/incidents/import/template?facilityId=${facilityId}` : "/api/incidents/import/template"}>
            Download template
          </a>
        </Button>
      </div>
    </form>
  );
}
