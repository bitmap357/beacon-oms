/** Button variants (default, secondary, ghost). Beacon navy hierarchy + restrained 3D press. */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "btn-3d inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[14px] font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
    "active:translate-y-px active:scale-[0.98] touch-manipulation disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white shadow-[var(--shadow-button)] hover:-translate-y-px hover:bg-brand-deep hover:shadow-[var(--shadow-button-hover)] active:shadow-[var(--shadow-button-active)]",
        secondary:
          "border border-hairline bg-surface-raised text-ink shadow-[var(--shadow-secondary)] hover:-translate-y-px hover:border-brand/35 hover:bg-surface hover:shadow-[var(--shadow-secondary-hover)] active:shadow-[var(--shadow-secondary-active)]",
        ghost: "text-ink hover:bg-muted/70 hover:text-ink",
        danger:
          "bg-[#791F1F] text-white shadow-[0_1px_0_rgba(92,23,23,0.35),0_2px_6px_rgba(92,23,23,0.16),inset_0_1px_0_rgba(255,255,255,0.14)] hover:-translate-y-px hover:bg-[#5c1717] hover:shadow-[0_2px_0_rgba(92,23,23,0.3),0_6px_14px_rgba(92,23,23,0.22),inset_0_1px_0_rgba(255,255,255,0.16)] active:shadow-[inset_0_2px_5px_rgba(60,12,12,0.4)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
