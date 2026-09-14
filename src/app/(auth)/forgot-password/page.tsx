"use client";

/** Request a reset email. Action: forgotPasswordAction */
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { forgotPasswordAction } from "@/app/(auth)/actions";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);

  async function onSubmit(formData: FormData) {
    await forgotPasswordAction(formData);
    setDone(true);
  }

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
          <h1 className="font-heading mb-2 text-xl text-ink">Reset password</h1>
          {done ? (
            <p className="text-sm text-slate">
              If that email is registered, a reset link is on its way.
            </p>
          ) : (
            <form action={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <Button className="w-full">Send reset link</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
