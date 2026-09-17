"use client";

/** Confirm archive/delete + optional edit dialog for list/detail rows. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { SimpleForm } from "@/components/forms";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

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
  confirmTitle,
  confirmDescription,
  successToast,
  redirectTo,
  compact = false,
}: {
  path: string;
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  successToast?: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      await apiRequest(path, undefined, "DELETE");
      toast.success(successToast || (label === "Archive" ? "Archived" : "Deleted"));
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not ${label.toLowerCase()}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size={compact ? "icon" : "sm"}
        className={compact ? "h-7 w-7" : undefined}
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        {compact ? <Trash2 className="h-3.5 w-3.5" /> : label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle || `Delete this record?`}
        description={
          confirmDescription ||
          "This cannot be undone. Related history stays in the audit trail."
        }
        confirmLabel={label}
        danger
        pending={pending}
        onConfirm={onDelete}
      />
    </>
  );
}

export function EditDeleteControls({
  path,
  method = "PATCH",
  fields,
  canEdit = true,
  canDelete = true,
  compact = false,
  title = "Edit",
  deleteLabel = "Delete",
  deleteConfirmTitle,
  deleteConfirmDescription,
  deleteSuccessToast,
}: {
  path: string;
  method?: string;
  fields: Field[];
  canEdit?: boolean;
  canDelete?: boolean;
  compact?: boolean;
  title?: string;
  deleteLabel?: string;
  deleteConfirmTitle?: string;
  deleteConfirmDescription?: string;
  deleteSuccessToast?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!canEdit && !canDelete) return null;

  return (
    <div className={compact ? "flex flex-nowrap items-center gap-1" : "flex flex-wrap items-center gap-2"}>
      {canEdit ? (
        <Button
          type="button"
          variant="secondary"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-7 w-7" : undefined}
          onClick={() => setOpen(true)}
          aria-label={title}
        >
          {compact ? <Pencil className="h-3.5 w-3.5" /> : title}
        </Button>
      ) : null}
      {canDelete ? (
        <DeleteButton
          path={path}
          compact={compact}
          label={deleteLabel}
          confirmTitle={deleteConfirmTitle}
          confirmDescription={deleteConfirmDescription}
          successToast={deleteSuccessToast}
        />
      ) : null}
      {canEdit ? (
        <Dialog open={open} onOpenChange={setOpen} title={title}>
          <SimpleForm
            action={path}
            method={method}
            submitLabel="Save"
            fields={fields}
            onSuccess={() => setOpen(false)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
