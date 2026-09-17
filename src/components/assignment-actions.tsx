"use client";

/** Make lead, make member, or remove a teammate from a facility. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

function asIso(value: string | Date) {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function AssignmentActions({
  assignmentId,
  isLead,
  updatedAt: initialUpdatedAt,
}: {
  assignmentId: string;
  isLead: boolean;
  updatedAt: string;
}) {
  const router = useRouter();
  const [endOpen, setEndOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Keep concurrency token fresh after Make lead / Make member so Remove still works.
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  useEffect(() => {
    setUpdatedAt(initialUpdatedAt);
  }, [initialUpdatedAt]);

  async function patch(body: Record<string, unknown>, success: string) {
    try {
      const data = await apiRequest<{ assignment: { updatedAt: string } }>(
        `/api/assignments/${assignmentId}`,
        { ...body, updatedAt },
        "PATCH",
      );
      if (data.assignment?.updatedAt) {
        setUpdatedAt(asIso(data.assignment.updatedAt));
      }
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update assignment");
    }
  }

  async function removeAssignment() {
    setPending(true);
    try {
      await apiRequest(
        `/api/assignments/${assignmentId}`,
        { isActive: false, updatedAt },
        "PATCH",
      );
      toast.success("Removed from team");
      setEndOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove teammate");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1">
      {isLead ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void patch({ isLead: false }, "Now a team member")}
        >
          Make member
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void patch({ isLead: true }, "Now the lead")}
        >
          Make lead
        </Button>
      )}
      <Button type="button" size="sm" variant="secondary" onClick={() => setEndOpen(true)}>
        Remove from team
      </Button>
      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="Remove this person from the team?"
        description="They stay in assignment history but are no longer on the active team. You can assign them again later."
        confirmLabel="Remove from team"
        danger
        pending={pending}
        onConfirm={removeAssignment}
      />
    </span>
  );
}
