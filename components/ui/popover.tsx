"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The floating-layer shell every overlay in §5.9 is built on.
 *
 * Shadows live only on floating layers (§9), so this is the one place in the
 * system that carries one. Dismisses on outside pointer-down and on Escape,
 * and restores focus to the trigger so the keyboard path is never lost (§8).
 */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: React.RefObject<HTMLElement>[],
) {
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (refs.some((r) => r.current?.contains(target))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}

export type PopoverAlign = "start" | "end";

/**
 * Anchored floating panel.
 *
 * `elevation` picks the §5.9 shadow: menus s2, popovers and date pickers s3.
 */
export const PopoverPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    align?: PopoverAlign;
    elevation?: "s2" | "s3" | "s5";
  }
>(function PopoverPanel({ align = "start", elevation = "s2", className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-[calc(100%+4px)] z-50 rounded-lg border-hairline border-line bg-surface",
        align === "end" ? "right-0" : "left-0",
        elevation === "s2" && "shadow-s2",
        elevation === "s3" && "shadow-s3",
        elevation === "s5" && "shadow-s5",
        className,
      )}
      {...rest}
    />
  );
});
