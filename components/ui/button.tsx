import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Button — DESIGN_SYSTEM.md §5.5.
 *
 * Every button is h-8, rounded-md (8px), px-2, gap-2, text-sm/500, 16px icon.
 * Six variants; secondary is the default because "a screen full of grey-outline
 * buttons with at most one filled primary is the correct density".
 *
 * Loading keeps the label and the width, and swaps the leading icon for a 14px
 * spinner, so the button never collapses mid-action.
 */
export type ButtonVariant =
  | "secondary"
  | "primary"
  | "accent"
  | "ghost"
  | "destructive"
  | "icon";

const VARIANT: Record<ButtonVariant, string> = {
  secondary:
    "border-hairline border-line bg-transparent text-ink hover:bg-item-hover hover:border-line-hover",
  primary: "border-0 bg-[#172131] text-white hover:bg-[#2b3854]",
  accent: "border-0 bg-[#6895ff] text-white hover:bg-[#5480ea]",
  ghost: "border-0 bg-transparent text-ink-secondary hover:bg-item-hover hover:text-ink",
  destructive:
    "border-hairline border-[rgba(245,74,69,.2)] bg-transparent text-[#f54a45] hover:bg-state-error-bg",
  icon: "border-hairline border-line bg-transparent text-ink-secondary hover:bg-item-hover hover:border-line-hover",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Leading icon; replaced by the spinner while loading. */
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", loading = false, icon, className, children, disabled, ...rest },
  ref,
) {
  const isIconOnly = variant === "icon";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium",
        "transition-colors ease-standard",
        isIconOnly ? "size-8 p-0" : "px-2",
        VARIANT[variant],
        (disabled || loading) && "pointer-events-none opacity-50",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        icon && <span className="grid size-4 shrink-0 place-items-center [&_svg]:size-4">{icon}</span>
      )}
      {children}
    </button>
  );
});
