"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/forms";
import { toast } from "sonner";

export function MarkReadButton({ id, isRead }: { id: string; isRead: boolean }) {
  const router = useRouter();
  if (isRead) return null;

  async function mark() {
    try {
      await apiRequest(`/api/notifications/${id}/read`, undefined, "PATCH");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark read");
    }
  }

  return (
    <Button type="button" size="sm" variant="secondary" onClick={mark}>
      Mark read
    </Button>
  );
}

export function MarkAllReadButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  if (ids.length === 0) return null;

  async function markAll() {
    try {
      await Promise.all(ids.map((id) => apiRequest(`/api/notifications/${id}/read`, undefined, "PATCH")));
      toast.success("Caught up");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark read");
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={markAll}>
      Mark all read
    </Button>
  );
}
