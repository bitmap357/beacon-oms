"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { FacilityHealthThresholds } from "@/lib/settings";
import { toast } from "sonner";

function NumberField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function FacilityHealthSettingsForm({
  initial,
  defaults,
}: {
  initial: FacilityHealthThresholds;
  defaults: FacilityHealthThresholds;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState(initial);

  async function onSave() {
    setPending(true);
    try {
      const res = await fetch("/api/settings/facility-health", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save settings");
      toast.success("Health thresholds saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading mb-2 text-[15px]">Critical</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField
            label="Min open critical incidents"
            name="criticalOpenMin"
            value={values.critical.criticalOpenMin}
            onChange={(criticalOpenMin) =>
              setValues((prev) => ({
                ...prev,
                critical: { ...prev.critical, criticalOpenMin },
              }))
            }
          />
          <NumberField
            label="Min high/critical open >7 days"
            name="criticalUnresolved"
            value={values.critical.unresolvedHighOver7DaysMin}
            onChange={(unresolvedHighOver7DaysMin) =>
              setValues((prev) => ({
                ...prev,
                critical: { ...prev.critical, unresolvedHighOver7DaysMin },
              }))
            }
          />
        </div>
      </div>
      <div>
        <h3 className="font-heading mb-2 text-[15px]">At risk</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField
            label="Min open incidents"
            name="atRiskOpen"
            value={values.atRisk.openIncidentsMin}
            onChange={(openIncidentsMin) =>
              setValues((prev) => ({
                ...prev,
                atRisk: { ...prev.atRisk, openIncidentsMin },
              }))
            }
          />
          <NumberField
            label="Min high/critical open"
            name="atRiskHigh"
            value={values.atRisk.highPriorityOpenMin}
            onChange={(highPriorityOpenMin) =>
              setValues((prev) => ({
                ...prev,
                atRisk: { ...prev.atRisk, highPriorityOpenMin },
              }))
            }
          />
          <NumberField
            label="Min overdue actions"
            name="atRiskOverdue"
            value={values.atRisk.overdueActionsMin}
            onChange={(overdueActionsMin) =>
              setValues((prev) => ({
                ...prev,
                atRisk: { ...prev.atRisk, overdueActionsMin },
              }))
            }
          />
          <NumberField
            label="Min high/critical open >7 days"
            name="atRiskUnresolved"
            value={values.atRisk.unresolvedHighOver7DaysMin}
            onChange={(unresolvedHighOver7DaysMin) =>
              setValues((prev) => ({
                ...prev,
                atRisk: { ...prev.atRisk, unresolvedHighOver7DaysMin },
              }))
            }
          />
        </div>
      </div>
      <div>
        <h3 className="font-heading mb-2 text-[15px]">Attention required</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField
            label="Min open incidents"
            name="attentionOpen"
            value={values.attention.openIncidentsMin}
            onChange={(openIncidentsMin) =>
              setValues((prev) => ({
                ...prev,
                attention: { ...prev.attention, openIncidentsMin },
              }))
            }
          />
          <NumberField
            label="Min overdue actions"
            name="attentionOverdue"
            value={values.attention.overdueActionsMin}
            onChange={(overdueActionsMin) =>
              setValues((prev) => ({
                ...prev,
                attention: { ...prev.attention, overdueActionsMin },
              }))
            }
          />
          <NumberField
            label="Min old failed/retest QA"
            name="attentionQa"
            value={values.attention.oldPendingQAMin}
            onChange={(oldPendingQAMin) =>
              setValues((prev) => ({
                ...prev,
                attention: { ...prev.attention, oldPendingQAMin },
              }))
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          {pending ? "Saving…" : "Save thresholds"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setValues(defaults)}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
