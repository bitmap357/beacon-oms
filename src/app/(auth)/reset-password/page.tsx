"use client";

/** Set a new password from the emailed token. */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { CREDENTIAL_HINT } from "@/lib/password";

function ResetForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(formData: FormData) {
    const result = await resetPasswordAction(formData);
    if (result && "error" in result && result.error) setError(result.error);
    else setOk(true);
  }

  if (ok) {
    return (
      <p className="text-sm text-slate">
        Password updated. You can now{" "}
        <a className="text-brand" href="/login">
          sign in
        </a>
        .
      </p>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={params.get("token") || ""} />
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required />
        <p className="mt-1 text-[12px] text-slate">{CREDENTIAL_HINT}</p>
      </div>
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      <Button className="w-full">Update password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={40} />
          <p className="font-heading text-xl text-ink">Beacon</p>
        </div>
        <div className="rounded-[16px] border border-hairline bg-surface-raised p-7">
          <h1 className="font-heading mb-4 text-xl text-ink">Choose a new password</h1>
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
