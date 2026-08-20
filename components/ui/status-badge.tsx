import { BADGE_STYLE, type BadgeSpec } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — DESIGN_SYSTEM.md §5.8.
 *
 * rounded-sm (6px) · h-5 · px-1.5 · 12px/500 · light background, dark text of
 * the same hue. Exactly six states exist; the fifteen-state order machine is
 * mapped onto them in lib/status.ts rather than growing a seventh colour.
 *
 * The label is always rendered — colour never carries the meaning alone (§8).
 */
export function StatusBadge({
  spec,
  dot = false,
  className,
}: {
  spec: BadgeSpec;
  /** Optional 6px leading dot in the base colour. */
  dot?: boolean;
  className?: string;
}) {
  const { bg, fg } = BADGE_STYLE[spec.tone];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-sm px-1.5 text-xs font-medium",
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {dot && (
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: fg }} aria-hidden />
      )}
      {spec.label}
    </span>
  );
}
