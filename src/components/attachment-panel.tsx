"use client";

/** Upload and list files via POST /api/attachments. */
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "sonner";
import { DeleteButton } from "@/components/record-actions";

type AttachmentRow = { id: string; fileName: string; fileSizeBytes: number };

export function AttachmentPanel({
  relatedType,
  relatedId,
  attachments,
}: {
  relatedType: "INCIDENT" | "ACTIVITY" | "REPORT" | "QA_RECORD";
  relatedId: string;
  attachments: AttachmentRow[];
}) {
  const router = useRouter();

  async function onUpload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a file first");
      return;
    }
    formData.set("relatedType", relatedType);
    formData.set("relatedId", relatedId);
    try {
      const res = await fetch("/api/attachments", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Session expired. Sign in again.");
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success("File attached");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-heading flex items-center gap-2 text-[18px]">
        <Paperclip className="h-4 w-4 text-brand" />
        Attachments
      </h3>
      {attachments.length === 0 ? (
        <p className="text-sm text-slate">No files yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {attachments.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <a
                className="text-brand"
                href={`/api/attachments/${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.fileName}
              </a>
              <span className="font-mono text-[12px] text-slate">
                {Math.max(1, Math.round(row.fileSizeBytes / 1024))} KB
              </span>
              <DeleteButton compact path={`/api/attachments/${row.id}`} label="Remove file" />
            </li>
          ))}
        </ul>
      )}
      <form action={onUpload} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label>Add a file</Label>
          <Input name="file" type="file" required />
        </div>
        <Button>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </form>
    </div>
  );
}
