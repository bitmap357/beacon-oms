"use client";

/** Log or edit a visit/activity with a timestamp, optional report, and optional file. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PeoplePicker } from "@/components/people-picker";
import { apiRequest } from "@/components/forms";
import { REPORT_SECTIONS, labelFor } from "@/lib/reportTemplates";
import {
  ACTIVITY_TYPES,
  reportTypeForActivity,
  uploadActivityFile,
} from "@/lib/activity-types";
import { toast } from "sonner";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function timeFromIso(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateFromIso(value?: string | Date | null) {
  if (!value) return todayIso();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return todayIso();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type ActivitySeed = {
  id: string;
  type: string;
  date: string | Date;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  responsibleUserId: string;
  description?: string | null;
  findings?: string | null;
  participantIds?: string[];
};

export function ActivityForm({
  facilityId,
  facilityName,
  users,
  currentUserId,
  canWriteReport = false,
  activity,
  onSaved,
}: {
  facilityId: string;
  facilityName: string;
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  canWriteReport?: boolean;
  activity?: ActivitySeed;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [responsibleUserId, setResponsibleUserId] = useState(
    activity?.responsibleUserId || currentUserId || users[0]?.id || "",
  );
  const [visitType, setVisitType] = useState(activity?.type || "SITE_VISIT");
  const [attachReport, setAttachReport] = useState(false);

  async function onSubmit(formData: FormData) {
    const date = String(formData.get("date"));
    const start = String(formData.get("startTime") || "");
    const end = String(formData.get("endTime") || "");
    const responsible = String(formData.get("responsibleUserId") || "");
    const participantIds = formData
      .getAll("participantIds")
      .map(String)
      .filter((id) => id && id !== responsible);
    const type = String(formData.get("type") || "SITE_VISIT");
    const payload = {
      facilityId,
      type,
      date,
      startTime: start ? `${date}T${start}:00` : null,
      endTime: end ? `${date}T${end}:00` : null,
      responsibleUserId: responsible,
      participantIds,
      description: formData.get("description") || "",
      findings: formData.get("findings") || null,
    };
    try {
      const created = activity
        ? await apiRequest<{ activity: { id: string } }>(
            `/api/activities/${activity.id}`,
            payload,
            "PATCH",
          )
        : await apiRequest<{ activity: { id: string } }>("/api/activities", payload);
      const activityId = created.activity?.id || activity?.id;
      const file = formData.get("file");
      if (activityId && file instanceof File && file.size > 0) {
        await uploadActivityFile(activityId, file);
      }
      if (!activity && canWriteReport && formData.get("attachReport") === "on" && activityId) {
        const reportType = reportTypeForActivity(type);
        await apiRequest("/api/reports", {
          type: reportType,
          facilityId,
          activityId,
          date,
          content: Object.fromEntries(
            REPORT_SECTIONS[reportType].map((key) => [
              key,
              String(formData.get(`content.${key}`) || "").trim(),
            ]).filter(([, value]) => value),
          ),
        });
      }
      toast.success(activity ? "Visit updated" : "Activity recorded");
      onSaved?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  const reportType = reportTypeForActivity(visitType);

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="facilityId" value={facilityId} />
      <div>
        <Label>Type</Label>
        <Select
          name="type"
          required
          value={visitType}
          onChange={(event) => setVisitType(event.target.value)}
        >
          {ACTIVITY_TYPES.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Date</Label>
        <Input name="date" type="date" required defaultValue={dateFromIso(activity?.date)} />
      </div>
      <div>
        <Label>Starts</Label>
        <Input name="startTime" type="time" defaultValue={timeFromIso(activity?.startTime) || "09:00"} />
      </div>
      <div>
        <Label>Ends</Label>
        <Input name="endTime" type="time" defaultValue={timeFromIso(activity?.endTime) || "12:00"} />
      </div>
      <div>
        <Label>Responsible</Label>
        <Select
          name="responsibleUserId"
          required
          value={responsibleUserId}
          onChange={(event) => setResponsibleUserId(event.target.value)}
        >
          {users.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <p className="mb-1 text-[14px] text-slate">Members (optional)</p>
        <PeoplePicker users={users} excludeId={responsibleUserId} selectedIds={activity?.participantIds} />
      </div>
      <div className="md:col-span-2">
        <Label>Notes (optional)</Label>
        <Textarea
          name="description"
          defaultValue={activity?.description || ""}
          placeholder={`What happened at ${facilityName}`}
        />
      </div>
      <div className="md:col-span-2">
        <Label>Findings (optional)</Label>
        <Textarea name="findings" defaultValue={activity?.findings || ""} />
      </div>
      <div className="md:col-span-2">
        <Label>Attach a report file (optional)</Label>
        <Input name="file" type="file" />
      </div>
      {!activity && canWriteReport ? (
        <label className="md:col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="attachReport"
            checked={attachReport}
            onChange={(event) => setAttachReport(event.target.checked)}
          />
          Also fill in a structured report
        </label>
      ) : null}
      {attachReport
        ? REPORT_SECTIONS[reportType].map((key) => (
            <div key={key} className="md:col-span-2">
              <Label>{labelFor(key)} (optional)</Label>
              <Textarea name={`content.${key}`} />
            </div>
          ))
        : null}
      <div className="md:col-span-2">
        <Button>
          <Plus className="h-4 w-4" />
          {activity ? "Save visit" : "Record activity"}
        </Button>
      </div>
    </form>
  );
}

export function EditVisitButton({
  facilityId,
  facilityName,
  users,
  currentUserId,
  activity,
  canWriteReport = false,
  compact = false,
}: {
  facilityId: string;
  facilityName: string;
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  activity: ActivitySeed;
  canWriteReport?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={compact ? "icon" : "sm"}
        className={compact ? "h-7 w-7" : undefined}
        onClick={() => setOpen(true)}
        aria-label="Edit visit"
      >
        <Pencil className="h-4 w-4" />
        {compact ? null : "Edit"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Edit visit"
        className="max-h-[90vh] overflow-y-auto"
      >
        <ActivityForm
          facilityId={facilityId}
          facilityName={facilityName}
          users={users}
          currentUserId={currentUserId}
          canWriteReport={canWriteReport}
          activity={activity}
          onSaved={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

