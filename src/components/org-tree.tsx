"use client";

/** Org / facility / branch tree on /admin/organizations. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { toast } from "sonner";
import { apiRequest } from "@/components/forms";
import { StatusPill } from "@/components/ui/status-pill";
import { EditDeleteControls } from "@/components/record-actions";

export function OrganizationTree({
  canManageOrgs,
  canManageFacilities,
  organizations,
}: {
  canManageOrgs: boolean;
  canManageFacilities: boolean;
  organizations: Array<{
    id: string;
    name: string;
    regions: Array<{ id: string; name: string }>;
    facilities: Array<{
      id: string;
      name: string;
      location: string | null;
      regionId: string | null;
      region: { id: string; name: string } | null;
      contactPerson: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      status: string;
      updatedAt: Date | string;
      branches: Array<{
        id: string;
        name: string;
        location: string | null;
        contactPerson: string | null;
        contactPhone: string | null;
        contactEmail: string | null;
      }>;
      _count: { incidents: number; actions: number; reports: number };
    }>;
  }>;
}) {
  const router = useRouter();

  async function addOrganization(formData: FormData) {
    try {
      await apiRequest("/api/client-organizations", { name: formData.get("name") });
      toast.success("Organization added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  async function addRegion(orgId: string, formData: FormData) {
    try {
      await apiRequest(`/api/client-organizations/${orgId}/regions`, {
        name: formData.get("name"),
      });
      toast.success("Region added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  async function addFacility(orgId: string, formData: FormData) {
    try {
      await apiRequest("/api/facilities", {
        name: formData.get("name"),
        clientOrganizationId: orgId,
        regionId: formData.get("regionId") || null,
        location: formData.get("location"),
        contactPerson: formData.get("contactPerson"),
        contactPhone: formData.get("contactPhone"),
        contactEmail: formData.get("contactEmail"),
      });
      toast.success("Facility added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  async function addBranch(facilityId: string, formData: FormData) {
    try {
      await apiRequest(`/api/facilities/${facilityId}/branches`, {
        name: formData.get("name"),
        location: formData.get("location"),
        contactPerson: formData.get("contactPerson"),
        contactPhone: formData.get("contactPhone"),
        contactEmail: formData.get("contactEmail"),
      });
      toast.success("Branch added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  return (
    <div className="space-y-6">
      {canManageOrgs ? (
        <form action={addOrganization} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label>New organization</Label>
            <Input name="name" required placeholder="Organization name" />
          </div>
          <Button>Add organization</Button>
        </form>
      ) : null}

      {organizations.map((org) => (
        <section key={org.id} className="rounded-[12px] border border-hairline bg-surface-raised p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-[20px] text-ink">{org.name}</h2>
              <p className="text-[13px] text-slate">
                {org.facilities.length} facilit{org.facilities.length === 1 ? "y" : "ies"} ·
                name is on the organization; location lives on each facility and branch
              </p>
            </div>
            {canManageOrgs ? (
              <EditDeleteControls
                path={`/api/client-organizations/${org.id}`}
                canDelete={false}
                title="Edit name"
                fields={[
                  { name: "name", label: "Organization name", required: true, defaultValue: org.name },
                ]}
              />
            ) : null}
          </div>

          {org.regions.length ? (
            <p className="mb-3 text-[13px] text-slate">
              Regions: {org.regions.map((row) => row.name).join(", ")}
            </p>
          ) : (
            <p className="mb-3 text-[13px] text-slate">No regions yet. Optional — facilities can sit on the organization without one.</p>
          )}

          {canManageOrgs ? (
            <form
              action={(formData) => addRegion(org.id, formData)}
              className="mb-5 flex flex-wrap items-end gap-3"
            >
              <div className="min-w-48 flex-1">
                <Label>New region</Label>
                <Input name="name" required placeholder="Region name" />
              </div>
              <Button variant="secondary">Add region</Button>
            </form>
          ) : null}

          {canManageFacilities ? (
            <form
              action={(formData) => addFacility(org.id, formData)}
              className="mb-5 grid gap-3 rounded-[10px] bg-surface p-3 md:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <Label>Facility name</Label>
                <Input name="name" required />
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" placeholder="City, campus, or site" />
              </div>
              <div>
                <Label>Region (optional)</Label>
                <Select name="regionId" defaultValue="">
                  <option value="">No region</option>
                  {org.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Contact person (optional)</Label>
                <Input name="contactPerson" placeholder="Name" />
              </div>
              <div>
                <Label>Contact phone (optional)</Label>
                <Input name="contactPhone" />
              </div>
              <div>
                <Label>Contact email (optional)</Label>
                <Input name="contactEmail" type="email" />
              </div>
              <div className="flex items-end">
                <Button>Add facility</Button>
              </div>
            </form>
          ) : null}

          <div className="space-y-4">
            {org.facilities.length === 0 ? (
              <p className="text-sm text-slate">No facilities yet. Add one to start logging incidents.</p>
            ) : (
              org.facilities.map((facility) => (
                <article key={facility.id} className="rounded-[10px] border border-hairline p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link className="font-heading text-[16px] text-brand" href={`/facilities/${facility.id}`}>
                        {facility.name}
                      </Link>
                      <p className="text-[12px] text-slate">
                        {[facility.region?.name, facility.location || "No location set"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={facility.status} />
                      {canManageFacilities ? (
                        <EditDeleteControls
                          path={`/api/facilities/${facility.id}`}
                          canDelete={false}
                          title="Edit facility"
                          fields={[
                            { name: "name", label: "Facility name", required: true, defaultValue: facility.name },
                            {
                              name: "regionId",
                              label: "Region",
                              defaultValue: facility.regionId || "",
                              options: [
                                { value: "", label: "No region" },
                                ...org.regions.map((region) => ({
                                  value: region.id,
                                  label: region.name,
                                })),
                              ],
                            },
                            { name: "location", label: "Location", defaultValue: facility.location || "" },
                            { name: "contactPerson", label: "Contact person", defaultValue: facility.contactPerson || "" },
                            { name: "contactPhone", label: "Contact phone", defaultValue: facility.contactPhone || "" },
                            { name: "contactEmail", label: "Contact email", defaultValue: facility.contactEmail || "" },
                            {
                              name: "updatedAt",
                              label: "Current timestamp",
                              type: "hidden",
                              defaultValue:
                                typeof facility.updatedAt === "string"
                                  ? facility.updatedAt
                                  : facility.updatedAt.toISOString(),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] text-slate">
                    <Link className="text-brand" href={`/incidents?facilityId=${facility.id}`}>
                      {facility._count.incidents} incident{facility._count.incidents === 1 ? "" : "s"}
                    </Link>
                    {" · "}
                    <Link className="text-brand" href={`/actions?facilityId=${facility.id}`}>
                      {facility._count.actions} action{facility._count.actions === 1 ? "" : "s"}
                    </Link>
                    {" · "}
                    <Link className="text-brand" href={`/reports?facilityId=${facility.id}`}>
                      {facility._count.reports} report{facility._count.reports === 1 ? "" : "s"}
                    </Link>
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {facility.branches.length === 0 ? (
                      <li className="text-slate">No branches — incidents apply to the whole facility.</li>
                    ) : (
                      facility.branches.map((branch) => (
                        <li key={branch.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="text-ink">{branch.name}</span>
                            {branch.location ? (
                              <span className="text-slate"> · {branch.location}</span>
                            ) : (
                              <span className="text-slate"> · No location set</span>
                            )}
                            {branch.contactPerson ? (
                              <span className="text-slate"> · {branch.contactPerson}</span>
                            ) : null}
                          </span>
                          {canManageFacilities ? (
                            <EditDeleteControls
                              compact
                              path={`/api/facilities/${facility.id}/branches/${branch.id}`}
                              title="Edit branch"
                              fields={[
                                { name: "name", label: "Branch name", required: true, defaultValue: branch.name },
                                { name: "location", label: "Location", defaultValue: branch.location || "" },
                                { name: "contactPerson", label: "Contact person", defaultValue: branch.contactPerson || "" },
                                { name: "contactPhone", label: "Contact phone", defaultValue: branch.contactPhone || "" },
                                { name: "contactEmail", label: "Contact email", defaultValue: branch.contactEmail || "" },
                              ]}
                            />
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                  {canManageFacilities ? (
                    <form
                      action={(formData) => addBranch(facility.id, formData)}
                      className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                    >
                      <Input name="name" required placeholder="Branch name" />
                      <Input name="location" placeholder="Location (optional)" />
                      <Input name="contactPerson" placeholder="Contact person (optional)" />
                      <Input name="contactPhone" placeholder="Phone (optional)" />
                      <Input name="contactEmail" type="email" placeholder="Email (optional)" />
                      <Button variant="secondary">Add branch</Button>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
