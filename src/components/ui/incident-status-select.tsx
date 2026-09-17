"use client";

/**
 * Compact incident status picker — TonePill colours, listbox keyboard a11y.
 * Portaled menu so table overflow does not clip options.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { labelIncidentStatus } from "@/lib/incident-status";
import { cn } from "@/lib/utils";
import { incidentStatusTone, tonePillClass } from "@/components/ui/status-pill";

type IncidentStatusSelectProps = {
  options: readonly string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** `sm` for table cells; `md` for forms. */
  size?: "sm" | "md";
  "aria-label"?: string;
  id?: string;
};

type MenuPos = { top: number; left: number; minWidth: number; openUp: boolean };

export function IncidentStatusSelect({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
  className,
  size = "sm",
  "aria-label": ariaLabel = "Incident status",
  id,
}: IncidentStatusSelectProps) {
  const listboxId = useId();
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? options[0] ?? "");
  const value = isControlled ? valueProp : internal;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setMounted(true), []);

  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt === value),
  );

  const updatePos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(options.length * 36 + 16, 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 8 && rect.top > spaceBelow;
    const minWidth = Math.max(rect.width, 11.5 * 16);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - minWidth - 8);
    }
    setPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left,
      minWidth,
      openUp,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    setActiveIndex(selectedIndex);
  }, [open, selectedIndex, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePos();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const next = options[activeIndex];
      if (next) commit(next);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const tone = incidentStatusTone(value);
  const compact = size === "sm";

  const menu =
    mounted && open && pos
      ? createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            className={cn(
              "status-picker-panel fixed z-[80] overflow-hidden rounded-xl border border-hairline bg-surface-raised p-1 shadow-[0_12px_32px_rgba(12,24,48,0.16)]",
              pos.openUp && "status-picker-panel--up",
            )}
            style={{
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              minWidth: pos.minWidth,
            }}
            onKeyDown={onListKeyDown}
          >
            {options.map((opt, index) => {
              const selected = opt === value;
              const optTone = incidentStatusTone(opt);
              return (
                <button
                  key={opt}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-[background-color,transform] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                    "hover:bg-brand/[0.06] active:scale-[0.99]",
                    (selected || index === activeIndex) && "bg-brand/[0.08]",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(opt)}
                >
                  <span
                    className={cn(
                    "inline-flex min-w-0 flex-1 items-center rounded-full px-2 py-0.5 text-[12px] font-medium leading-5 tracking-[0.01em]",
                    tonePillClass(optTone),
                  )}
                >
                  {labelIncidentStatus(opt)}
                </span>
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-brand transition-opacity duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full font-medium transition-[box-shadow,transform,filter] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
          "hover:brightness-[0.97] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
          open && "ring-2 ring-brand/30",
          tonePillClass(tone),
          compact ? "h-7 gap-0.5 pl-2.5 pr-1.5 text-[12px]" : "h-9 gap-1 pl-3 pr-2 text-[13px]",
        )}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="truncate">{labelIncidentStatus(value)}</span>
        <ChevronDown
          className={cn(
            "shrink-0 opacity-70 transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}
