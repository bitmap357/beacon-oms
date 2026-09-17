/** Table primitives (THead, TR, TH, TD) — denser ops typography. */
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
      <table
        className={cn(
          "w-full min-w-[36rem] text-center text-[14px] leading-snug md:min-w-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className="border-b border-hairline bg-surface/80"
      {...props}
    />
  );
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("interactive-row border-b border-hairline last:border-b-0", className)} {...props} />
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-slate lg:px-3",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 text-center align-middle text-ink lg:py-2.5", className)} {...props} />
  );
}
