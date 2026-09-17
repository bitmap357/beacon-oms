"use client";

/**
 * Forced / voluntary password change. Uses a normal submit handler (not form action)
 * so validation errors render inline and the session cookie refresh is reliable.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CREDENTIAL_HINT } from "@/lib/password-policy";
import { BrandMark } from "@/components/brand";
import { toast } from "sonner";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    try {
      if (!password || !confirm) {
        throw new Error("Enter and confirm your new password");
      }
      if (password !== confirm) {
        throw new Error("Passwords do not match");
      }
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not update password",
        );
      }
      toast.success("Password updated");
      // Hard navigation so the next auth()/JWT reload sees mustResetPassword=false.
      window.location.assign("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update password";
      setError(message);
      toast.error(message);
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
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
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
              minLength={8}
            />
          </div>
          <p className="text-[12px] text-slate">{CREDENTIAL_HINT}</p>
          {error ? (
            <p className="rounded-lg border border-[#791F1F]/30 bg-[#791F1F]/10 px-3 py-2 text-[13px] text-[#791F1F]" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
