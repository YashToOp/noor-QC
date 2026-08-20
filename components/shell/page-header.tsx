import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Page header — DESIGN_SYSTEM.md §4.3.
 *
 * h-11, py-2 pl-2 pr-6, title 20px/500, actions right. No border underneath
 * and no breadcrumbs by default — the sidebar is the breadcrumb. §4.3 allows a
 * 12px #8793a3 breadcrumb line above the title for genuinely deep hierarchies
 * (Gate queue ▸ MO-1042), and shrinks the header to h-14 to fit both.
 */
export function PageHeader({
  title,
  breadcrumb,
  actions,
}: {
  title: string;
  breadcrumb?: { label: string; href: string }[];
  actions?: React.ReactNode;
}) {
  const hasCrumb = Boolean(breadcrumb?.length);

  return (
    <header
      className={
        hasCrumb
          ? "flex h-14 shrink-0 items-center justify-between py-2 pl-2 pr-6"
          : "flex h-11 shrink-0 items-center justify-between py-2 pl-2 pr-6"
      }
    >
      <div className="min-w-0">
        {hasCrumb && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-ink-secondary">
            {breadcrumb!.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3 text-ink-sub" aria-hidden />}
                <Link href={c.href} className="rounded-sm hover:text-ink">
                  {c.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-medium leading-7 text-ink">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
