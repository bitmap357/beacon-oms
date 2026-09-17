/** Admin facility health threshold settings. */
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { getFacilityHealthThresholds, DEFAULT_FACILITY_HEALTH } from "@/lib/settings";
import { describeFacilityHealthCriteria } from "@/lib/rules/facilityHealth";
import { FacilityHealthSettingsForm } from "@/components/facility-health-settings-form";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MANAGEMENT") {
    redirect("/dashboard");
  }
  const thresholds = await getFacilityHealthThresholds();
  const criteria = describeFacilityHealthCriteria(thresholds);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure facility health thresholds used for calculated status."
      />
      <Card className="mb-4 p-5">
        <h2 className="font-heading mb-2 text-[16px]">Current criteria</h2>
        <ul className="space-y-1 text-[13px] text-ink">
          {criteria.map((row) => (
            <li key={row.status}>
              <span className="font-medium text-brand">{row.status}:</span> {row.rule}
            </li>
          ))}
        </ul>
      </Card>
      {user.role === "ADMIN" ? (
        <Card className="p-5">
          <FacilityHealthSettingsForm
            initial={thresholds}
            defaults={DEFAULT_FACILITY_HEALTH}
          />
        </Card>
      ) : (
        <p className="text-sm text-slate">Only admins can edit these thresholds.</p>
      )}
    </div>
  );
}
