import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea — DESIGN_SYSTEM.md §5.6, the multi-line form of the input.
 *
 * Same 8px radius, same 0.5px border with the hover lift and no border change
 * on focus, same 14px/400 ink and #8793a3 placeholder. The one thing it does
 * not inherit is the 32px control height, which only applies to single-line
 * controls; the padding matches the input's so a stacked form stays aligned.
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, helper, error, className, id, rows = 3, ...rest }, ref) {
    const generated = React.useId();
    const textareaId = id ?? generated;
    const describedBy = error
      ? `${textareaId}-err`
      : helper
        ? `${textareaId}-help`
        : undefined;

    return (
      <div className="flex w-full flex-col">
        {label && (
          <label htmlFor={textareaId} className="mb-1.5 text-xs font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full resize-y rounded-md border-hairline bg-surface px-2 py-1.5 text-sm text-ink",
            "transition-colors placeholder:text-ink-sub hover:border-line-hover",
            error ? "border-[#f54a45]" : "border-line",
            className,
          )}
          {...rest}
        />
        {error ? (
          <span id={`${textareaId}-err`} className="mt-1.5 text-xs text-[#f54a45]">
            {error}
          </span>
        ) : (
          helper && (
            <span id={`${textareaId}-help`} className="mt-1.5 text-xs text-ink-sub">
              {helper}
            </span>
          )
        )}
      </div>
    );
  },
);
