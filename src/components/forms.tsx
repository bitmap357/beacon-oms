"use client";

/**
 * Generic POST forms and GenerateReportForm (operational report → /reports/[id]).
 * apiRequest is the fetch wrapper used by calendar visit logging too.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { toast } from "sonner";

export async function apiRequest<T>(
  path: string,
  body?: unknown,
  method = "POST",
) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function FacilityForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [orgId, setOrgId] = useState(organizations[0]?.id || "");

  async function onSubmit(formData: FormData) {
    try {
      await apiRequest("/api/facilities", {
        name: formData.get("name"),
        clientOrganizationId: formData.get("clientOrganizationId"),
        location: formData.get("location"),
        contactInfo: formData.get("contactInfo"),
      });
      toast.success("Facility created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label>Facility name</Label>
        <Input name="name" required />
      </div>
      <div>
        <Label>Organization</Label>
        <Select
          name="clientOrganizationId"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Location</Label>
        <Input name="location" />
      </div>
      <div className="md:col-span-2">
        <Label>Contact</Label>
        <Input name="contactInfo" />
      </div>
      <div className="md:col-span-2">
        <Button>Create facility</Button>
      </div>
    </form>
  );
}

export function SimpleForm({
  action,
  fields,
  submitLabel,
  method = "POST",
}: {
  action: string;
  fields: Array<{
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    textarea?: boolean;
  }>;
  submitLabel: string;
  method?: string;
}) {
  const router = useRouter();
  async function onSubmit(formData: FormData) {
    try {
      const body: Record<string, unknown> = {};
      for (const field of fields) {
        const value = formData.get(field.name);
        const resolved = value === "" ? null : value;
        if (field.name.includes(".")) {
          const [head, ...rest] = field.name.split(".");
          const current = (body[head] as Record<string, unknown>) || {};
          current[rest.join(".")] = resolved;
          body[head] = current;
        } else {
          body[field.name] = resolved;
        }
      }
      await apiRequest(action, body, method);
      toast.success("Saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  }
  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <div key={field.name} className={field.textarea ? "md:col-span-2" : ""}>
          <Label>{field.label}</Label>
          {field.options ? (
            <Select name={field.name} required={field.required}>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          ) : field.textarea ? (
            <Textarea name={field.name} required={field.required} />
          ) : (
            <Input
              name={field.name}
              type={field.type || "text"}
              required={field.required}
            />
          )}
        </div>
      ))}
      <div className="md:col-span-2">
        <Button>{submitLabel}</Button>
      </div>
    </form>
  );
}

export function GenerateReportForm({
  facilities,
}: {
  facilities: Array<{ id: string; name: string; branches: { id: string; name: string }[] }>;
}) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState(facilities[0]?.id || "");
  const branches = facilities.find((row) => row.id === facilityId)?.branches || [];

  async function onSubmit(formData: FormData) {
    try {
      const data = await apiRequest<{ report: { id: string } }>("/api/reports/generate", {
        facilityId: formData.get("facilityId"),
        branchId: formData.get("branchId") || null,
        from: formData.get("from"),
        to: formData.get("to"),
      });
      toast.success("Operational report generated");
      router.push(`/reports/${data.report.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate");
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
          <option value="">All branches</option>
          {branches.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>From</Label>
        <Input name="from" type="date" required />
      </div>
      <div>
        <Label>To</Label>
        <Input name="to" type="date" required />
      </div>
      <div className="md:col-span-2">
        <Button>Generate operational report</Button>
      </div>
    </form>
  );
}
