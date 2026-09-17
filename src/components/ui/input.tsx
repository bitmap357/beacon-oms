/** Input, Label, Select, Textarea — shared form controls with navy focus. */
import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase = [
  "w-full rounded-xl border border-hairline bg-surface-raised text-ink",
  "shadow-[inset_0_1px_2px_rgba(28,36,48,0.03)]",
  "transition-[border-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
  "placeholder:text-slate/80",
  "hover:border-brand/30",
  "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/35",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        fieldBase,
        "h-11 px-3 text-base md:h-10 md:text-[14px]",
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
        fieldBase,
        "min-h-24 px-3 py-2.5 text-base md:text-[14px]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[12px] font-medium tracking-[0.02em] text-slate",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-11 appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-base md:h-10 md:text-[14px]",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%235B6472%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')]",
        className,
      )}
      {...props}
    />
  );
}
