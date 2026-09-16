"use client";

/** Create an action. Related incidents follow the selected facility. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/components/forms";
import { incidentLabel, labelize } from "@/lib/utils";
import { toast } from "sonner";

type IncidentOption = {
  id: string;
  facilityId: string;
  description?: string | null;
  title?: string | null;
  reportedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export function ActionForm({
  facilities,
  incidents,
  users,
  defaultFacilityId,
  defaultIncidentId,
  lockFacility,
  lockIncident,
}: {
  facilities: { id: string; name: string }[];
  incidents: IncidentOption[];
  users: { id: string; name: string }[];
  defaultFacilityId?: string;
  defaultIncidentId?: string;
  lockFacility?: boolean;
  lockIncident?: boolean;
}) {
  const router = useRouter();
  const initialFacility =
    (defaultIncidentId && incidents.find((row) => row.id === defaultIncidentId)?.facilityId) ||
    defaultFacilityId ||
    facilities[0]?.id ||
    "";
  const [facilityId, setFacilityId] = useState(initialFacility);
  const related = useMemo(
    () => incidents.filter((row) => row.facilityId === facilityId),
    [incidents, facilityId],
  );

  async function onSubmit(formData: FormData) {
    try {
      await apiRequest("/api/actions", {
        facilityId: formData.get("facilityId"),
        incidentId: formData.get("incidentId") || null,
        title: formData.get("title"),
        ownerId: formData.get("ownerId"),
        priority: formData.get("priority"),
        dueDate: formData.get("dueDate"),
        description: formData.get("description"),
      });
      toast.success("Action created");
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
          disabled={lockFacility}
          onChange={(event) => setFacilityId(event.target.value)}
        >
          {facilities.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
        {lockFacility ? <input type="hidden" name="facilityId" value={facilityId} /> : null}
      </div>
      <div>
        <Label>Related incident</Label>
        <Select
          name="incidentId"
          key={`${facilityId}-${defaultIncidentId || ""}`}
          defaultValue={
            lockIncident || related.some((row) => row.id === defaultIncidentId)
              ? defaultIncidentId
              : ""
          }
          disabled={lockIncident}
        >
          {lockIncident ? null : <option value="">None</option>}
          {related.map((row) => (
            <option key={row.id} value={row.id}>
              {incidentLabel(row)}
            </option>
          ))}
        </Select>
        {lockIncident && defaultIncidentId ? (
          <input type="hidden" name="incidentId" value={defaultIncidentId} />
        ) : null}
      </div>
      <div className="md:col-span-2">
        <Label>Title</Label>
        <Input name="title" required minLength={4} />
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
        <Label>Priority</Label>
        <Select name="priority" required defaultValue="MEDIUM">
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
            <option key={value} value={value}>
              {labelize(value)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Due date</Label>
        <Input name="dueDate" type="date" required />
      </div>
      <div className="md:col-span-2">
        <Label>Description</Label>
        <Textarea name="description" />
      </div>
      <div className="md:col-span-2">
        <Button>Save action</Button>
      </div>
    </form>
  );
}
