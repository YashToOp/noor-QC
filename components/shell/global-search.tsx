"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Search, Users } from "lucide-react";
import { PopoverPanel, useDismiss } from "@/components/ui/popover";
import { useAppUsers, useClients, useHouses } from "@/lib/queries";
import { searchParties, type SearchHit } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * Global partner search — DESIGN_SYSTEM.md §5.6's page-level search at 36px,
 * living in the sidebar so it is reachable from every screen.
 *
 * Finds a client or a house by name, code, id, city or phone. Results show
 * *why* they matched, because a box that searches six fields is otherwise
 * unreadable — a hit on a phone number looks identical to a hit on a name.
 *
 * Fully keyboard-driven (§8): ↓/↑ move, Enter opens the highlighted row or
 * falls through to the full results page, Escape closes.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrapRef]);

  const clients = useClients();
  const houses = useHouses();
  const users = useAppUsers();

  const hits = React.useMemo(
    () =>
      searchParties({
        query,
        clients: clients.data ?? [],
        houses: houses.data ?? [],
        users: users.data ?? [],
      }).slice(0, 8),
    [query, clients.data, houses.data, users.data],
  );

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[active]) go(hits[active]);
      else if (query.trim()) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative px-3 pt-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-ink-sub"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          placeholder="Search clients, houses, phone…"
          aria-label="Search clients and houses"
          aria-expanded={open && hits.length > 0}
          aria-controls="global-search-results"
          role="combobox"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-9 w-full rounded-md border-hairline border-line bg-surface pl-[30px] pr-2 text-sm text-ink",
            "transition-colors placeholder:text-ink-sub hover:border-line-hover",
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
      </div>

      {open && query.trim() && (
        <PopoverPanel
          id="global-search-results"
          elevation="s2"
          className="left-3 right-3 max-h-[320px] overflow-y-auto p-1"
          role="listbox"
        >
          {hits.length === 0 ? (
            <p className="px-2 py-3 text-xs text-ink-secondary">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  i === active ? "bg-item-active" : "hover:bg-item-hover",
                )}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-sm bg-well text-ink-secondary"
                  aria-hidden
                >
                  {hit.kind === "client" ? (
                    <Users className="size-3.5" />
                  ) : (
                    <Building2 className="size-3.5" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">{hit.title}</span>
                  <span className="truncate text-xs text-ink-secondary">{hit.matchedOn}</span>
                </span>
              </button>
            ))
          )}
        </PopoverPanel>
      )}
    </div>
  );
}
