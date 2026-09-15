"use client";

/** Log a visit/activity with a responsible person and optional members. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PeoplePicker } from "@/components/people-picker";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function ActivityForm({
  facilityId,
  facilityName,
  users,
  currentUserId,
}: {
  facilityId: string;
  facilityName: string;
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [responsibleUserId, setResponsibleUserId] = useState(currentUserId || users[0]?.id || "");

  async function onSubmit(formData: FormData) {
    const responsible = String(formData.get("responsibleUserId") || "");
    const participantIds = formData
      .getAll("participantIds")
      .map(String)
      .filter((id) => id && id !== responsible);
    try {
      await apiRequest("/api/activities", {
        facilityId,
        type: formData.get("type"),
        date: formData.get("date"),
        responsibleUserId: responsible,
        participantIds,
        description: formData.get("description") || "",
      });
      toast.success("Activity recorded");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="facilityId" value={facilityId} />
      <div>
        <Label>Type</Label>
        <Select name="type" required defaultValue="SITE_VISIT">
          <option value="SITE_VISIT">Site visit</option>
          <option value="DEMONSTRATION">Demo / meeting</option>
          <option value="TRAINING">Training</option>
        </Select>
      </div>
      <div>
        <Label>Date</Label>
        <Input name="date" type="date" required defaultValue={todayIso()} />
        <p className="text-[12px] text-slate">Past or future dates are fine.</p>
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
        <PeoplePicker users={users} excludeId={responsibleUserId} />
      </div>
      <div className="md:col-span-2">
        <Label>Notes (optional)</Label>
        <Textarea name="description" placeholder={`What happened at ${facilityName}`} />
      </div>
      <div className="md:col-span-2">
        <Button>
          <Plus className="h-4 w-4" />
          Record activity
        </Button>
      </div>
    </form>
  );
}
