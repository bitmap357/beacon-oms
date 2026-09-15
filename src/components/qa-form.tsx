"use client";

/** QA create form: related incidents follow the selected facility. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/components/forms";
import { incidentLabel, labelize } from "@/lib/utils";
import { toast } from "sonner";

export function QaForm({
  facilities,
  incidents,
  defaultFacilityId,
  defaultIncidentId,
}: {
  facilities: { id: string; name: string }[];
  incidents: { id: string; facilityId: string; createdAt: Date | string }[];
  defaultFacilityId?: string;
  defaultIncidentId?: string;
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
      await apiRequest("/api/qa-records", {
        facilityId: formData.get("facilityId"),
        relatedIncidentId: formData.get("relatedIncidentId") || null,
        qaDate: formData.get("qaDate"),
        result: formData.get("result"),
        findings: formData.get("findings"),
      });
      toast.success("QA recorded");
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
          onChange={(event) => setFacilityId(event.target.value)}
        >
          {facilities.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Related incident</Label>
        <Select
          name="relatedIncidentId"
          key={facilityId}
          defaultValue={related.some((row) => row.id === defaultIncidentId) ? defaultIncidentId : ""}
        >
          <option value="">None</option>
          {related.map((row) => (
            <option key={row.id} value={row.id}>
              {incidentLabel(row)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>QA date</Label>
        <Input name="qaDate" type="date" required />
      </div>
      <div>
        <Label>Result</Label>
        <Select name="result" required defaultValue="PASSED">
          {["PASSED", "FAILED", "PASSED_WITH_ISSUES", "REQUIRES_RETEST"].map((value) => (
            <option key={value} value={value}>
              {labelize(value)}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Findings</Label>
        <Textarea name="findings" />
      </div>
      <div className="md:col-span-2">
        <Button>Record QA</Button>
      </div>
    </form>
  );
}
