/** Input, Label, Select, Textarea — shared form controls. */
import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-hairline bg-surface-raised px-3 text-base text-ink placeholder:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-10 md:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl border border-hairline bg-surface-raised px-3 py-2 text-base text-ink placeholder:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1 block text-[14px] text-slate", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-hairline bg-surface-raised px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-10 md:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}
