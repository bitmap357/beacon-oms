"use client";

/** Sign-in UI (split panel + theme toggle). Submit goes to loginAction in src/app/(auth)/actions.ts. */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { loginAction } from "@/app/(auth)/actions";

export function LoginPanel() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="relative min-h-screen bg-surface">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#070b14] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-16 top-16 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-10 left-10 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <BrandMark size={72} />
            <p className="font-heading mt-6 text-4xl">Beacon</p>
            <p className="mt-2 text-sm text-[#9aa3b2]">Operations Management System</p>
          </div>
          <div className="relative max-w-md">
            <p className="font-heading text-3xl leading-snug">
              See every facility, incident, and visit in one place.
            </p>
            <p className="mt-4 text-sm text-[#9aa3b2]">
              Spagad teams log site visits, track actions, and generate reports without losing the thread.
            </p>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <BrandMark size={48} />
              <p className="font-heading mt-3 text-2xl text-ink">Beacon</p>
              <p className="text-[13px] text-slate">Operations Management System</p>
            </div>
            <div className="rounded-[16px] border border-hairline bg-surface-raised p-7 shadow-[0_18px_50px_rgba(12,20,36,0.08)]">
              <h1 className="font-heading mb-1 text-2xl text-ink">Sign in</h1>
              <p className="mb-6 text-[13px] text-slate">
                Use your Beacon account to continue.
              </p>
              <form action={onSubmit} className="space-y-4">
                <input
                  type="hidden"
                  name="callbackUrl"
                  value={params.get("callbackUrl") || "/dashboard"}
                />
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="you@spagad.local"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
                <Button className="w-full" disabled={pending}>
                  {pending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <p className="mt-4 text-center text-[13px]">
                <a className="text-brand" href="/forgot-password">
                  Forgot password
                </a>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
