"use client";

/** Modal dialog + confirm prompt. Used for edits and destructive actions. */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-hairline bg-surface-raised p-5 shadow-[0_18px_50px_rgba(12,20,36,0.18)] outline-none",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-heading text-[18px] text-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[13px] text-slate">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={pending ? () => undefined : onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? "danger" : "default"}
          disabled={pending}
          onClick={() => void onConfirm()}
        >
          {pending ? "Working..." : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
