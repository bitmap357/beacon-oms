"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CREDENTIAL_HINT } from "@/lib/password";
import { BrandMark } from "@/components/brand";
import { toast } from "sonner";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: formData.get("password"),
          confirm: formData.get("confirm"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update password");
      toast.success("Password updated");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update password");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-raised p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <p className="font-heading text-lg text-ink">Beacon</p>
            <p className="text-[12px] text-slate">Choose a new password</p>
          </div>
        </div>
        <h1 className="font-heading mb-2 text-xl text-ink">Password reset required</h1>
        <p className="mb-4 text-sm text-slate">
          Your account needs a new password before you can continue.
        </p>
        <form action={onSubmit} className="grid gap-3">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <p className="text-[12px] text-slate">{CREDENTIAL_HINT}</p>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
