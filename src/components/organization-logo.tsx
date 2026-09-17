"use client";

/** Organization logo preview + optional upload. POST /api/client-organizations/[id]/logo */
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function OrganizationLogoMark({
  organizationId,
  hasLogo,
  name,
  size = 32,
  className,
}: {
  organizationId: string;
  hasLogo: boolean;
  name?: string;
  size?: number;
  className?: string;
}) {
  const initial = (name?.trim()?.[0] || "O").toUpperCase();
  if (!hasLogo) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-hairline bg-status-gold-bg font-heading text-status-gold-fg",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/client-organizations/${organizationId}/logo`}
      alt={name ? `${name} logo` : ""}
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-md border border-hairline bg-surface-raised object-contain",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export function OrganizationLogoForm({
  organizationId,
  hasLogo,
  name,
}: {
  organizationId: string;
  hasLogo: boolean;
  name?: string;
}) {
  const router = useRouter();

  async function onUpload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a PNG, JPEG, or WebP image");
      return;
    }
    try {
      const res = await fetch(`/api/client-organizations/${organizationId}/logo`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Session expired. Sign in again.");
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success("Organization logo saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function onRemove() {
    try {
      const res = await fetch(`/api/client-organizations/${organizationId}/logo`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Session expired. Sign in again.");
      if (!res.ok) throw new Error(data.error || "Could not remove logo");
      toast.success("Organization logo removed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove logo");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <OrganizationLogoMark
          organizationId={organizationId}
          hasLogo={hasLogo}
          name={name}
          size={64}
        />
        <p className="text-[13px] text-slate">
          Square PNG, JPEG, or WebP, up to 2 MB. Shown on this page and on facility reports for this organization.
        </p>
      </div>
      <form action={onUpload} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`org-logo-${organizationId}`}>Organization logo</Label>
          <Input
            id={`org-logo-${organizationId}`}
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </div>
        <Button>
          <Upload className="h-4 w-4" />
          {hasLogo ? "Replace logo" : "Upload logo"}
        </Button>
        {hasLogo ? (
          <Button type="button" variant="secondary" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </form>
    </div>
  );
}
