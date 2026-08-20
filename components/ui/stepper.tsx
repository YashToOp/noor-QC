import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Approval stepper — DESIGN_SYSTEM.md §7.6, the one extension this product
 * genuinely needs. The gate detail page is built on it.
 *
 *   done    — #172131 fill + white check
 *   current — #172131 ring on white
 *   pending — #d5d5e8 ring
 *   connector 1px #d5d5e8 · circles 24px · labels 12px
 *
 * State is spelled out for assistive technology as well as drawn, so the step
 * a gate sits at is never carried by the ring colour alone (§8).
 */
export type StepState = "done" | "current" | "pending";

export interface Step {
  id: string;
  label: string;
  state: StepState;
}

export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex w-full items-start", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.id}
            className={cn("flex min-w-0 flex-col items-center", !last && "flex-1")}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  step.state === "done" && "bg-[#172131] text-white",
                  step.state === "current" && "bg-surface ring-2 ring-inset ring-[#172131]",
                  step.state === "pending" && "bg-surface ring-1 ring-inset ring-line",
                )}
              >
                {step.state === "done" ? (
                  <Check className="size-3.5" strokeWidth={2} aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      step.state === "current" ? "bg-[#172131]" : "bg-line",
                    )}
                    aria-hidden
                  />
                )}
              </span>
              {!last && <span className="h-px flex-1 bg-line" aria-hidden />}
            </div>
            <span
              className={cn(
                "mt-2 max-w-[104px] px-1 text-center text-xs leading-tight",
                step.state === "pending" ? "text-ink-sub" : "font-medium text-ink",
              )}
            >
              {step.label}
            </span>
            <span className="sr-only">
              {step.state === "done" ? "completed" : step.state === "current" ? "current step" : "not started"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
