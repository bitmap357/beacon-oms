"use client";

/** Inline status + add-action + optional comment on the incidents list. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { IncidentStatusPill, PriorityPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { apiRequest } from "@/components/forms";
import { EditDeleteControls } from "@/components/record-actions";
import { incidentStatusOptions, canonicalIncidentStatus, labelIncidentStatus } from "@/lib/incident-status";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { toast } from "sonner";
import { MessageSquare, Plus } from "lucide-react";

function asIso(value: string | Date) {
  return typeof value === "string" ? value : value.toISOString();
}

type IncidentRowData = {
  id: string;
  status: string;
  priority: string;
  description: string;
  facilityId: string;
  facilityName: string;
  branchName?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  reportedAt: string;
  updatedAt: string;
  actionCount: number;
  resolutionInfo?: string | null;
};

type IncidentRowProps = {
  incident: IncidentRowData;
  users: { id: string; name: string }[];
  canManage: boolean;
  canUpdate: boolean;
  canClose: boolean;
  canAddAction: boolean;
  canAssign?: boolean;
  variant?: "row" | "card";
};

export function IncidentInbox({
  incidents,
  users,
  canManage,
  canUpdate,
  canClose,
  canAddAction,
  canAssign = false,
}: {
  incidents: IncidentRowData[];
  users: { id: string; name: string }[];
  canManage: boolean;
  canUpdate: boolean;
  canClose: boolean;
  canAddAction: boolean;
  canAssign?: boolean;
}) {
  const shared = { users, canManage, canUpdate, canClose, canAddAction, canAssign };
  return (
    <>
      <div className="space-y-3 md:hidden">
        {incidents.map((incident) => (
          <IncidentRow key={incident.id} variant="card" incident={incident} {...shared} />
        ))}
      </div>
      <Card className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Incident</TH>
              <TH>Facility / branch</TH>
              <TH>Priority</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
              <TH>Assignee</TH>
              <TH>Date reported</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {incidents.map((incident) => (
              <IncidentRow key={incident.id} variant="row" incident={incident} {...shared} />
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

export function IncidentRow({
  incident,
  users,
  canManage,
  canUpdate,
  canClose,
  canAddAction,
  canAssign: _canAssign = false,
  variant = "row",
}: IncidentRowProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const currentStatus = String(canonicalIncidentStatus(incident.status));
  const [status, setStatus] = useState(currentStatus);
  const [updatedAt, setUpdatedAt] = useState(incident.updatedAt);
  const statuses = incidentStatusOptions(canClose, status);
  const isArchived = Boolean(incident.archivedAt);

  useEffect(() => {
    setStatus(String(canonicalIncidentStatus(incident.status)));
    setUpdatedAt(incident.updatedAt);
  }, [incident.status, incident.updatedAt]);

  async function onStatus(next: string) {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    try {
      const data = await apiRequest<{
        incident: { status: string; updatedAt: string };
      }>(
        `/api/incidents/${incident.id}`,
        { status: next, updatedAt },
        "PATCH",
      );
      if (data.incident?.updatedAt) {
        setUpdatedAt(asIso(data.incident.updatedAt));
      }
      if (data.incident?.status) {
        setStatus(String(canonicalIncidentStatus(data.incident.status)));
      }
      toast.success("Status updated");
      router.refresh();
    } catch (error) {
      setStatus(previous);
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

  async function onComment(formData: FormData) {
    try {
      await apiRequest(`/api/incidents/${incident.id}/comments`, {
        body: formData.get("body"),
      });
      toast.success("Comment added");
      setCommenting(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not comment");
    }
  }

  const statusControl = canUpdate ? (
    <Select
      value={status}
      onChange={(event) => onStatus(event.target.value)}
      aria-label="Incident status"
    >
      {statuses.map((value) => (
        <option key={value} value={value}>
          {labelIncidentStatus(value)}
        </option>
      ))}
    </Select>
  ) : (
    <IncidentStatusPill status={incident.status} />
  );

  const compact = variant === "row";
  const actionButtons = (
    <div className={compact ? "flex items-center justify-end gap-1" : "flex flex-wrap gap-2"}>
      <Button
        type="button"
        variant="secondary"
        size={compact ? "icon" : "sm"}
        className={compact ? "h-7 w-7" : undefined}
        onClick={() => setCommenting((value) => !value)}
        aria-label={commenting ? "Close comment" : "Comment"}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {compact ? null : commenting ? "Close" : "Comment"}
      </Button>
      {canAddAction ? (
        <Button
          type="button"
          variant="secondary"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-7 w-7" : undefined}
          onClick={() => setAdding((value) => !value)}
          aria-label={adding ? "Close add action" : "Add action"}
        >
          <Plus className="h-3.5 w-3.5" />
          {compact ? null : adding ? "Close" : "Add action"}
        </Button>
      ) : null}
      {canManage && !isArchived ? (
        <EditDeleteControls
          compact={compact}
          path={`/api/incidents/${incident.id}`}
          deleteLabel="Archive"
          deleteConfirmTitle="Archive this incident?"
          deleteConfirmDescription="The incident is hidden from default lists. Comments and history are kept."
          deleteSuccessToast="Archived"
          fields={[
            {
              name: "description",
              label: "Incident",
              textarea: true,
              required: true,
              defaultValue: incident.description,
            },
            {
              name: "resolutionInfo",
              label: "Resolution (optional)",
              textarea: true,
              defaultValue: incident.resolutionInfo || "",
            },
            {
              name: "updatedAt",
              label: "Current timestamp",
              type: "hidden",
              defaultValue: incident.updatedAt,
            },
          ]}
        />
      ) : null}
    </div>
  );

  const commentForm = commenting ? (
    <form action={onComment} className="space-y-3 rounded-[12px] border border-hairline bg-surface p-4">
      <Label>Comment</Label>
      <Textarea name="body" required placeholder="Follow-up, waiting on a response, notes…" />
      <Button>Add comment</Button>
    </form>
  ) : null;

  const addActionForm = adding ? (
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
  ) : null;

  if (variant === "card") {
    return (
      <article className="rounded-2xl border border-hairline bg-surface-raised p-4">
        <div className="flex items-start justify-between gap-3">
          <Link className="min-w-0 flex-1 font-medium text-brand" href={`/incidents/${incident.id}`}>
            {incidentLabel(incident)}
          </Link>
          <span className="shrink-0">
            <PriorityPill priority={incident.priority} />
          </span>
        </div>
        <p className="mt-1 text-[13px] text-slate">
          <Link className="text-brand" href={`/facilities/${incident.facilityId}`}>
            {incident.facilityName}
          </Link>
          {incident.branchName ? ` · ${incident.branchName}` : ""}
        </p>
        <div className="mt-3 grid gap-2">
          {statusControl}
          <p className="text-[13px] text-slate">
            {incident.assigneeName || "Unassigned"} · {formatDate(incident.reportedAt)} ·{" "}
            <Link className="text-brand" href={`/actions?incidentId=${incident.id}`}>
              {incident.actionCount} {incident.actionCount === 1 ? "action" : "actions"}
            </Link>
          </p>
        </div>
        <div className="mt-3">{actionButtons}</div>
        {commentForm ? <div className="mt-3">{commentForm}</div> : null}
        {addActionForm ? <div className="mt-3">{addActionForm}</div> : null}
      </article>
    );
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
          <PriorityPill priority={incident.priority} />
        </TD>
        <TD>{statusControl}</TD>
        <TD>
          <Link className="text-brand" href={`/actions?incidentId=${incident.id}`}>
            {incident.actionCount}
          </Link>
        </TD>
        <TD>{incident.assigneeName || "—"}</TD>
        <TD className="font-mono text-[12px]">{formatDate(incident.reportedAt)}</TD>
        <TD className="whitespace-nowrap text-right">{actionButtons}</TD>
      </TR>
      {commentForm ? (
        <TR>
          <TD colSpan={8}>{commentForm}</TD>
        </TR>
      ) : null}
      {addActionForm ? (
        <TR>
          <TD colSpan={8}>{addActionForm}</TD>
        </TR>
      ) : null}
    </>
  );
}
