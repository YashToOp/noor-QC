import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — DESIGN_SYSTEM.md §5.6.
 *
 * 32px tall (36px for a page-level search) · 8px radius · 0.5px border →
 * hover #bdbdd6 → focus ring with no border change · 14px/400 text ·
 * #8793a3 placeholder. Error turns the border and helper text #f54a45 and
 * never fills the field red.
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helper?: string;
  error?: string;
  icon?: React.ReactNode;
  /** Page-level search sits at 36px; everything else at 32px. */
  size?: "default" | "search";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, icon, size = "default", className, id, ...rest },
  ref,
) {
  const generated = React.useId();
  const inputId = id ?? generated;
  const describedBy = error ? `${inputId}-err` : helper ? `${inputId}-help` : undefined;

  return (
    <div className="flex w-full flex-col">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 text-xs font-medium text-ink-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="pointer-events-none absolute left-2 top-1/2 grid size-4 -translate-y-1/2 place-items-center text-ink-sub [&_svg]:size-4"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-md border-hairline bg-surface text-sm text-ink transition-colors",
            "placeholder:text-ink-sub hover:border-line-hover",
            size === "search" ? "h-9" : "h-8",
            icon ? "pl-[30px] pr-2" : "px-2",
            error ? "border-[#f54a45]" : "border-line",
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <span id={`${inputId}-err`} className="mt-1.5 text-xs text-[#f54a45]">
          {error}
        </span>
      ) : (
        helper && (
          <span id={`${inputId}-help`} className="mt-1.5 text-xs text-ink-sub">
            {helper}
          </span>
        )
      )}
    </div>
  );
});
