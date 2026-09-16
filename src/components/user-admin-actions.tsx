"use client";

/** Edit, deactivate/reactivate, and force-reset on /admin/users. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EditDeleteControls } from "@/components/record-actions";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "PM_QA", label: "PM/QA" },
  { value: "DEVELOPER", label: "Developer" },
  { value: "MANAGEMENT", label: "Management" },
  { value: "ADMIN", label: "Admin" },
];

export function UserAdminActions({
  userId,
  name,
  email,
  role,
  isActive,
  isSelf,
  canForceReset,
}: {
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isSelf: boolean;
  canForceReset: boolean;
}) {
  const router = useRouter();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function deactivate() {
    setPending(true);
    try {
      await apiRequest(`/api/users/${userId}/deactivate`);
      toast.success("User deactivated");
      setDeactivateOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate");
    } finally {
      setPending(false);
    }
  }

  async function reactivate() {
    try {
      await apiRequest(`/api/users/${userId}`, { isActive: true }, "PATCH");
      toast.success("User reactivated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reactivate");
    }
  }

  async function forceReset() {
    setPending(true);
    try {
      await apiRequest(`/api/users/${userId}/force-reset`);
      toast.success("Reset email sent");
      setResetOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not force reset");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <EditDeleteControls
        path={`/api/users/${userId}`}
        canDelete={false}
        title="Edit"
        fields={[
          { name: "name", label: "Name", required: true, defaultValue: name },
          { name: "email", label: "Email", type: "email", required: true, defaultValue: email },
          {
            name: "role",
            label: "Role",
            required: true,
            defaultValue: role,
            options: ROLE_OPTIONS,
          },
        ]}
      />
      {isActive ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isSelf}
          title={isSelf ? "You cannot deactivate your own account" : undefined}
          onClick={() => setDeactivateOpen(true)}
        >
          Deactivate
        </Button>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => void reactivate()}>
          Reactivate
        </Button>
      )}
      {canForceReset ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => setResetOpen(true)}>
          Force reset
        </Button>
      ) : null}
      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate this user?"
        description="They will not be able to sign in. Active facility assignments will end."
        confirmLabel="Deactivate"
        danger
        pending={pending}
        onConfirm={deactivate}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Require a password reset?"
        description="Their current password will stop working. They will get an email with a reset link."
        confirmLabel="Send reset email"
        pending={pending}
        onConfirm={forceReset}
      />
    </div>
  );
}
