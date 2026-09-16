"use client";

/** Make lead or end an assignment on the facility team list. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

export function AssignmentActions({
  assignmentId,
  isLead,
  updatedAt,
}: {
  assignmentId: string;
  isLead: boolean;
  updatedAt: string;
}) {
  const router = useRouter();
  const [endOpen, setEndOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function makeLead() {
    try {
      await apiRequest(
        `/api/assignments/${assignmentId}`,
        { isLead: true, updatedAt },
        "PATCH",
      );
      toast.success("Lead updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change lead");
    }
  }

  async function endAssignment() {
    setPending(true);
    try {
      await apiRequest(
        `/api/assignments/${assignmentId}`,
        { isActive: false, updatedAt },
        "PATCH",
      );
      toast.success("Assignment ended");
      setEndOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end assignment");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1">
      {isLead ? null : (
        <Button type="button" size="sm" variant="secondary" onClick={() => void makeLead()}>
          Make lead
        </Button>
      )}
      <Button type="button" size="sm" variant="secondary" onClick={() => setEndOpen(true)}>
        End
      </Button>
      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End this assignment?"
        description="The person stays in history but is no longer on the active team. You can assign them again later."
        confirmLabel="End assignment"
        danger
        pending={pending}
        onConfirm={endAssignment}
      />
    </span>
  );
}
