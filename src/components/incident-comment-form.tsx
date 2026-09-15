"use client";

/** Append a comment on an incident. */
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

export function IncidentCommentForm({ incidentId }: { incidentId: string }) {
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    try {
      await apiRequest(`/api/incidents/${incidentId}/comments`, {
        body: formData.get("body"),
      });
      toast.success("Comment added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not comment");
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <Label>Add a comment</Label>
      <Textarea name="body" required placeholder="Follow-up, waiting on a response, notes…" />
      <Button>Post comment</Button>
    </form>
  );
}
