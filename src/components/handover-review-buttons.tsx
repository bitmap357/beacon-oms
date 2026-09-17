"use client";

/** Admin approve/reject controls for pending handovers. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

export function HandoverReviewButtons({ handoverId }: { handoverId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function review(decision: "APPROVED" | "REJECTED") {
    setPending(true);
    try {
      await apiRequest(`/api/handovers/${handoverId}/review`, { decision }, "POST");
      toast.success(decision === "APPROVED" ? "Handover approved" : "Handover rejected");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review handover");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => void review("APPROVED")}>
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => void review("REJECTED")}
      >
        Reject
      </Button>
    </div>
  );
}
