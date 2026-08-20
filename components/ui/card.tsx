import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — DESIGN_SYSTEM.md §5.1, "the atom of the whole system".
 *
 * 0.5px #d5d5e8 border · 16px radius · 16/20/24 padding · shadow: none.
 * The title truncates before it reaches the action cluster (gap-2 + min-w-0
 * on the title, shrink-0 on the action), which is the measured `pr-[90px]`.
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  action?: React.ReactNode;
  /** Hover border lift, for cards that are themselves a link. */
  interactive?: boolean;
  selected?: boolean;
  /** Drop the internal padding — used by the DataTable, which is a card with p-0. */
  flush?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { title, action, interactive, selected, flush, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-full flex-col justify-between gap-6 overflow-hidden",
        "rounded-xl border-hairline bg-surface transition-colors",
        flush ? "p-0" : "px-5 pb-6 pt-4",
        selected ? "border-line-selected" : "border-line",
        interactive && !selected && "hover:border-line-hover",
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className={cn("flex items-start justify-between gap-2", flush && "px-5 pt-4")}>
          {title ? (
            <h3 className="block min-w-0 truncate text-base font-medium leading-6 tracking-tight text-ink">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("relative flex h-full min-h-0 flex-col gap-4", flush && "gap-0")}>
        {children}
      </div>
    </div>
  );
});
