"use client";

/** Sign-in UI (split panel + theme toggle). Submit goes to loginAction in src/app/(auth)/actions.ts. */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand";
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
        <section className="relative hidden min-h-screen overflow-hidden bg-[#070b14] text-white lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/signin-panel.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/30 to-black/15" />
          <div className="relative z-10 flex min-h-screen w-full flex-col px-14 py-16">
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-[460px] rounded-[28px] bg-[#070b14]/55 px-8 py-10 ring-1 ring-white/10 backdrop-blur-md">
                <BrandLockup className="w-full" />
              </div>
            </div>
            <div className="max-w-lg">
              <p className="font-heading text-3xl leading-snug">
                See every facility, incident, and visit in one place.
              </p>
              <p className="mt-4 text-sm text-white/75">
                Spagad teams log site visits, track actions, and generate reports
                without losing the thread.
              </p>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <BrandLockup className="mx-auto w-52" />
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
