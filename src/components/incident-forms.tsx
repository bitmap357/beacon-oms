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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    facilityName: string;
    branchRequired: boolean;
    rows: Array<{
      row: number;
      incident: string;
      status: string;
      dateReported: string;
      branch: string | null;
      priority: string;
      error?: string;
      duplicate?: boolean;
    }>;
    summary: { total: number; valid: number; failed: number; duplicates: number };
  } | null>(null);
  const scopedId = facilityId || selectedFacilityId;

  async function runImport(mode: "preview" | "commit") {
    if (!file || file.size === 0) {
      toast.error("Choose an Excel file first");
      return;
    }
    if (!scopedId) {
      toast.error("Choose a facility before uploading");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("facilityId", scopedId);
    formData.set("mode", mode);
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
      if (mode === "preview") {
        setPreview(data);
        toast.success(
          `Preview ready: ${data.summary?.valid ?? 0} valid, ${data.summary?.failed ?? 0} issues`,
        );
        return;
      }
      toast.success(`Imported ${data.created} incident${data.created === 1 ? "" : "s"}`);
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate">
        Choose the facility here so names in Excel cannot be mistyped. Preview runs first — fix
        duplicates before commit. Columns: Incident, Status, DateReported. Optional: Branch,
        Priority, AssigneeEmail, DueDate. Branch is required when the facility has branches.
      </p>
      {!facilityId && facilities ? (
        <div>
          <Label>Facility</Label>
          <Select
            required
            value={selectedFacilityId}
            onChange={(event) => {
              setSelectedFacilityId(event.target.value);
              setPreview(null);
            }}
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
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void runImport("preview")}>
          <Upload className="h-4 w-4" />
          {pending ? "Working…" : "Preview upload"}
        </Button>
        <Button asChild variant="secondary">
          <a
            href={
              scopedId
                ? `/api/incidents/import/template?facilityId=${scopedId}`
                : "/api/incidents/import/template"
            }
          >
            Download template
          </a>
        </Button>
      </div>
      {preview ? (
        <div className="space-y-3 rounded-xl border border-hairline bg-surface p-3">
          <p className="text-[13px] text-ink">
            {preview.facilityName}: {preview.summary.valid} ready · {preview.summary.failed} blocked
            {preview.summary.duplicates ? ` · ${preview.summary.duplicates} duplicate(s)` : ""}
            {preview.branchRequired ? " · branch required" : ""}
          </p>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-center text-[12px]">
              <thead>
                <tr className="border-b border-hairline text-slate">
                  <th className="px-1 py-1.5">Row</th>
                  <th className="px-1 py-1.5">Incident</th>
                  <th className="px-1 py-1.5">Status</th>
                  <th className="px-1 py-1.5">Branch</th>
                  <th className="px-1 py-1.5">Issue</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.row}
                    className={
                      row.error ? "bg-[#791F1F]/5 text-[#791F1F]" : "text-ink"
                    }
                  >
                    <td className="px-1 py-1.5 font-mono">{row.row}</td>
                    <td className="max-w-[12rem] truncate px-1 py-1.5">{row.incident}</td>
                    <td className="px-1 py-1.5">{row.status}</td>
                    <td className="px-1 py-1.5">{row.branch || "—"}</td>
                    <td className="px-1 py-1.5">{row.error || (row.duplicate ? "Duplicate" : "OK")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            disabled={pending || preview.summary.failed > 0 || preview.summary.valid === 0}
            onClick={() => void runImport("commit")}
          >
            {pending ? "Importing…" : `Commit ${preview.summary.valid} row(s)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
