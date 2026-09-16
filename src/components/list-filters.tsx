"use client";

/** Shared list filters that keep the current URL query and can export the filtered view. */
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export type ListFilterField =
  | {
      name: string;
      label: string;
      kind: "select";
      options: Array<{ value: string; label: string }>;
      emptyLabel?: string;
    }
  | { name: string; label: string; kind: "date" }
  | { name: string; label: string; kind: "text"; placeholder?: string }
  | { name: string; label: string; kind: "checkbox"; checkedValue?: string };

export function ListFilters({
  fields,
  exportPath,
}: {
  fields: ListFilterField[];
  exportPath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const exportHref = exportPath
    ? `${exportPath}${params.toString() ? `?${params.toString()}` : ""}`
    : "";

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-raised p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
        {fields.map((field) => {
          if (field.kind === "select") {
            return (
              <div key={field.name} className="min-w-0 lg:w-48">
                <Label>{field.label}</Label>
                <Select
                  value={params.get(field.name) || ""}
                  onChange={(event) => setParam(field.name, event.target.value)}
                  aria-label={`Filter by ${field.label}`}
                >
                  <option value="">{field.emptyLabel || "All"}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            );
          }
          if (field.kind === "date") {
            return (
              <div key={field.name} className="min-w-0 lg:w-40">
                <Label>{field.label}</Label>
                <Input
                  type="date"
                  value={params.get(field.name) || ""}
                  onChange={(event) => setParam(field.name, event.target.value)}
                  aria-label={`Filter by ${field.label}`}
                />
              </div>
            );
          }
          if (field.kind === "text") {
            return (
              <DebouncedTextFilter
                key={field.name}
                name={field.name}
                label={field.label}
                placeholder={field.placeholder}
                value={params.get(field.name) || ""}
                onCommit={(value) => setParam(field.name, value)}
              />
            );
          }
          const checkedValue = field.checkedValue || "1";
          return (
            <label key={field.name} className="flex min-h-10 items-center gap-2 text-sm lg:mb-1">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={params.get(field.name) === checkedValue}
                onChange={(event) =>
                  setParam(field.name, event.target.checked ? checkedValue : "")
                }
              />
              {field.label}
            </label>
          );
        })}
        {exportPath ? (
          <Button asChild variant="secondary" className="lg:mb-0.5">
            <a href={exportHref}>
              <Download className="h-4 w-4" />
              Export
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DebouncedTextFilter({
  name,
  label,
  placeholder,
  value,
  onCommit,
}: {
  name: string;
  label: string;
  placeholder?: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  useEffect(() => {
    if (local === value) return;
    const timer = window.setTimeout(() => onCommit(local), 400);
    return () => window.clearTimeout(timer);
  }, [local, onCommit, value]);

  return (
    <div className="min-w-0 lg:w-52">
      <Label>{label}</Label>
      <Input
        value={local}
        placeholder={placeholder}
        onChange={(event) => setLocal(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(local);
        }}
        aria-label={`Filter by ${label}`}
        name={name}
      />
    </div>
  );
}
