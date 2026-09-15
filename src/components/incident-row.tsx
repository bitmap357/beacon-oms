"use client";

/** Inline status + add-action on the incidents list. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { TonePill } from "@/components/ui/status-pill";
import { TD, TR } from "@/components/ui/table";
import { apiRequest } from "@/components/forms";
import { EditDeleteControls } from "@/components/record-actions";
import { nextIncidentStatuses } from "@/lib/incident-status";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { toast } from "sonner";
import type { IncidentStatus } from "@/lib/db-types";

type IncidentRowData = {
  id: string;
  status: string;
  priority: string;
  facilityId: string;
  facilityName: string;
  branchName?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  createdAt: string;
  updatedAt: string;
  actionCount: number;
  resolutionInfo?: string | null;
};

export function IncidentRow({
  incident,
  users,
  canManage,
  canAddAction,
}: {
  incident: IncidentRowData;
  users: { id: string; name: string }[];
  canManage: boolean;
  canAddAction: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const statuses = nextIncidentStatuses(incident.status as IncidentStatus);

  async function onStatus(status: string) {
    if (status === incident.status) return;
    try {
      await apiRequest(`/api/incidents/${incident.id}`, {
        status,
        updatedAt: incident.updatedAt,
      }, "PATCH");
      toast.success("Status updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  }

  async function onAddAction(formData: FormData) {
    try {
      await apiRequest("/api/actions", {
        facilityId: incident.facilityId,
        incidentId: incident.id,
        title: formData.get("title"),
        ownerId: formData.get("ownerId"),
        priority: formData.get("priority") || incident.priority,
        dueDate: formData.get("dueDate"),
        description: formData.get("description"),
      });
      toast.success("Action added");
      setAdding(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add action");
    }
  }

  return (
    <>
      <TR>
        <TD>
          <Link className="text-brand" href={`/incidents/${incident.id}`}>
            {incidentLabel(incident)}
          </Link>
        </TD>
        <TD>
          <Link className="text-brand" href={`/facilities/${incident.facilityId}`}>
            {incident.facilityName}
          </Link>
          {incident.branchName ? <span className="text-slate"> · {incident.branchName}</span> : null}
        </TD>
        <TD>
          <TonePill tone={incident.priority === "CRITICAL" || incident.priority === "HIGH" ? "danger" : "warn"}>
            {labelize(incident.priority)}
          </TonePill>
        </TD>
        <TD>
          {canManage ? (
            <Select
              defaultValue={incident.status}
              onChange={(event) => onStatus(event.target.value)}
              aria-label="Incident status"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {labelize(status)}
                </option>
              ))}
            </Select>
          ) : (
            labelize(incident.status)
          )}
        </TD>
        <TD>
          <Link className="text-brand" href={`/actions?incidentId=${incident.id}`}>
            {incident.actionCount}
          </Link>
        </TD>
        <TD>{incident.assigneeName || "—"}</TD>
        <TD className="font-mono text-[12px]">{formatDate(incident.createdAt)}</TD>
        <TD>
          <div className="flex flex-wrap gap-2">
            {canAddAction ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setAdding((value) => !value)}>
                {adding ? "Close" : "Add action"}
              </Button>
            ) : null}
            {canManage ? (
              <EditDeleteControls
                path={`/api/incidents/${incident.id}`}
                fields={[
                  {
                    name: "resolutionInfo",
                    label: "Resolution (optional)",
                    textarea: true,
                    defaultValue: incident.resolutionInfo || "",
                  },
                  {
                    name: "updatedAt",
                    label: "Current timestamp",
                    options: [{ value: incident.updatedAt, label: "Use latest" }],
                    defaultValue: incident.updatedAt,
                  },
                ]}
              />
            ) : null}
          </div>
        </TD>
      </TR>
      {adding ? (
        <TR>
          <TD colSpan={8}>
            <form action={onAddAction} className="grid gap-3 rounded-[12px] border border-hairline bg-surface p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Action title</Label>
                <Input name="title" required />
              </div>
              <div>
                <Label>Owner</Label>
                <Select name="ownerId" required>
                  {users.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input name="dueDate" type="date" required />
              </div>
              <div>
                <Label>Priority</Label>
                <Select name="priority" defaultValue={incident.priority}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                    <option key={value} value={value}>
                      {labelize(value)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea name="description" />
              </div>
              <div className="md:col-span-2">
                <Button>Save action</Button>
              </div>
            </form>
          </TD>
        </TR>
      ) : null}
    </>
  );
}
