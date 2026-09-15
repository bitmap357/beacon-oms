"use client";

/** Confirm delete + optional edit dialog for list/detail rows. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SimpleForm } from "@/components/forms";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  textarea?: boolean;
  defaultValue?: string;
};

export function DeleteButton({
  path,
  label = "Delete",
  redirectTo,
}: {
  path: string;
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    setPending(true);
    try {
      await apiRequest(path, undefined, "DELETE");
      toast.success("Deleted");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="danger" size="sm" disabled={pending} onClick={onDelete}>
      {pending ? "Deleting..." : label}
    </Button>
  );
}

export function EditDeleteControls({
  path,
  method = "PATCH",
  fields,
  canEdit = true,
  canDelete = true,
}: {
  path: string;
  method?: string;
  fields: Field[];
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Edit"}
        </Button>
      ) : null}
      {canDelete ? <DeleteButton path={path} /> : null}
      {open ? (
        <div className="mt-3 w-full min-w-64 rounded-[12px] border border-hairline bg-surface p-4">
          <SimpleForm action={path} method={method} submitLabel="Save" fields={fields} />
        </div>
      ) : null}
    </div>
  );
}
