"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  FileText,
  Home,
  Layers,
  Receipt,
  Settings2,
  ShieldCheck,
  Palette,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntitySwitcher } from "./entity-switcher";
import { GlobalSearch } from "./global-search";
import { useGateQueue, useIssues, useTenant } from "@/lib/queries";

/**
 * Sidebar — DESIGN_SYSTEM.md §4.2, §5.4 and §7.1.
 *
 * 260px, sitting directly on the #f5f5fa canvas with **no border and no
 * separator**, pr-4 on the aside and px-3 on the nav list. Rows are 32px with
 * an 8px radius and 6px/8px padding; the active state is a grey pill plus a
 * 400→500 weight bump — no accent bar, no bold, no colour tint (§5.4).
 *
 * Grouping obeys §7.1: five groups, at most three rows each, well inside the
 * "max 4–6 rows, max 6 groups" ceiling. Badges appear only where the number
 * demands action — the gate queue and open issues, nowhere else.
 */
interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const tenant = useTenant();
  const queue = useGateQueue();
  const issues = useIssues();

  // The badge counts what actually awaits a decision, so it moves the instant
  // realtime invalidates the queue query.
  const pendingGates = queue.data?.length ?? 0;
  const openIssues =
    issues.data?.filter((i) => i.status !== "resolved" && i.status !== "rejected").length ?? 0;

  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "Home", icon: Home }] },
    {
      label: "Approvals",
      items: [
        { href: "/gates", label: "Gate queue", icon: ShieldCheck, badge: pendingGates },
        { href: "/samples", label: "Samples & shades", icon: Palette },
        { href: "/issues", label: "Issues", icon: AlertTriangle, badge: openIssues },
      ],
    },
    {
      label: "Orders",
      items: [
        { href: "/orders", label: "All orders", icon: ClipboardCheck },
        { href: "/enquiries", label: "Enquiries", icon: FileText },
        { href: "/production", label: "Production", icon: Factory },
      ],
    },
    {
      label: "Partners",
      items: [
        { href: "/clients", label: "Clients", icon: Users },
        { href: "/houses", label: "Houses", icon: Building2 },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/invoices", label: "Invoices", icon: Receipt },
        { href: "/payments", label: "Payments", icon: Banknote },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/masters", label: "Masters", icon: Boxes },
        { href: "/users", label: "Users & roles", icon: Settings2 },
      ],
    },
  ];

  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col bg-canvas pr-4">
      {/* Brand — h-14, px-4, wordmark beside the mark. */}
      <div className="flex h-14 items-center gap-2 px-4">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-sm bg-[#172131] text-white"
          aria-hidden
        >
          <Layers className="size-3.5" />
        </span>
        <span className="text-sm font-medium tracking-tight text-ink">Noor Core</span>
      </div>

      <EntitySwitcher name={tenant.data?.name ?? "Noor"} />

      {/* Partner search sits above the nav so it is reachable from every screen. */}
      <GlobalSearch />

      <nav className="mt-2 flex-1 overflow-y-auto px-3" aria-label="Main">
        {groups.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`}>
            {group.label && (
              <div className="px-2 pb-1 pt-6 text-xs font-medium uppercase text-ink-sub">
                {group.label}
              </div>
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer stack — §4.2 item 5. */}
      <div className="px-3 pb-4 pt-2">
        <div className="flex h-14 items-center gap-2 rounded-lg px-2">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-well text-sm font-medium text-ink-secondary"
            aria-hidden
          >
            T
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-ink">Tayeb</span>
            <span className="truncate text-xs text-ink-secondary">Owner</span>
          </span>
        </div>
        <div className="flex items-center gap-3 px-2 pt-1 text-xs text-ink-secondary">
          <span>Help</span>
          <span aria-hidden>·</span>
          <span>Updates</span>
        </div>
      </div>
    </aside>
  );
}

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link href={item.href} className="block" aria-current={active ? "page" : undefined}>
      <div
        className={cn(
          "flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 transition-colors",
          active ? "bg-item-active" : "hover:bg-item-hover",
        )}
      >
        <Icon
          className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-secondary")}
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate whitespace-nowrap text-sm leading-tight",
            active ? "font-medium text-ink" : "font-normal text-ink-secondary",
          )}
        >
          {item.label}
        </span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-state-error px-1.5 text-[11px] font-medium tabular-nums text-white">
            {item.badge}
            <span className="sr-only"> awaiting action</span>
          </span>
        )}
      </div>
    </Link>
  );
}
