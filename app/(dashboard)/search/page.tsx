"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppUsers, useClients, useHouses, useOrders } from "@/lib/queries";
import { searchParties, type SearchHit } from "@/lib/search";
import { orderBook } from "@/lib/profile";
import { formatCount, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * SEARCH — the full results page behind the sidebar box.
 *
 * Each hit carries the reason it matched and enough of the party's order book
 * to choose between two similar names without opening both.
 */
function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = React.useState(initial);

  React.useEffect(() => {
    setQuery(initial);
  }, [initial]);

  const clients = useClients();
  const houses = useHouses();
  const users = useAppUsers();
  const orders = useOrders();

  const hits = React.useMemo(
    () =>
      searchParties({
        query,
        clients: clients.data ?? [],
        houses: houses.data ?? [],
        users: users.data ?? [],
      }),
    [query, clients.data, houses.data, users.data],
  );

  const loading = clients.isLoading || houses.isLoading || users.isLoading;
  const currency = (orders.data ?? [])[0]?.currency ?? "USD";

  const bookFor = (hit: SearchHit) =>
    orderBook(
      (orders.data ?? []).filter((o) =>
        hit.kind === "client" ? o.client_id === hit.id : o.house_id === hit.id,
      ),
    );

  const clientHits = hits.filter((h) => h.kind === "client");
  const houseHits = hits.filter((h) => h.kind === "house");

  const section = (title: string, rows: SearchHit[], icon: React.ReactNode) =>
    rows.length > 0 && (
      <Card title={`${title} (${rows.length})`} className="col-span-6">
        <ul className="flex flex-col">
          {rows.map((hit) => {
            const book = bookFor(hit);
            return (
              <li key={`${hit.kind}-${hit.id}`}>
                <button
                  onClick={() => router.push(hit.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border-b border-line-divider px-2 py-3 text-left",
                    "transition-colors last:border-b-0 hover:bg-item-hover",
                  )}
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-well text-ink-secondary [&_svg]:size-4"
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{hit.title}</span>
                    <span className="truncate text-xs text-ink-secondary">{hit.subtitle}</span>
                    <span className="mt-1 inline-flex h-5 w-fit items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
                      {hit.matchedOn}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-sm tabular-nums text-ink">
                      {formatMoney(book.lifetimeValue, currency)}
                    </span>
                    <span className="text-xs tabular-nums text-ink-secondary">
                      {formatCount(book.total)} orders
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    );

  return (
    <>
      <PageHeader title="Search" />

      <div className="my-3 flex shrink-0 items-center gap-2">
        <div className="w-[420px]">
          <Input
            size="search"
            icon={<Search />}
            autoFocus
            placeholder="Name, code, id, city or phone"
            aria-label="Search clients and houses"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              router.replace(
                e.target.value.trim()
                  ? `/search?q=${encodeURIComponent(e.target.value.trim())}`
                  : "/search",
              );
            }}
          />
        </div>
        {query.trim() && !loading && (
          <span className="text-sm text-ink-secondary">
            {formatCount(hits.length)} {hits.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="grid grid-cols-12 items-start gap-4">
          {loading ? (
            <Card title=" " className="col-span-12 h-[240px]">
              <Skeleton className="h-full w-full" />
            </Card>
          ) : !query.trim() ? (
            <Card title="Search" className="col-span-12">
              <EmptyState
                icon={<Search />}
                title="Find a client or a house"
                description="Search by name, code, record id, city, or a phone number off a message. Phone numbers resolve through the contact who owns them."
              />
            </Card>
          ) : hits.length === 0 ? (
            <Card title="Search" className="col-span-12">
              <EmptyState
                icon={<Search />}
                title={`Nothing matches "${query.trim()}"`}
                description="Try a shorter fragment, a partner code, or the last few digits of a phone number."
                action={{ label: "Clear search", onClick: () => router.replace("/search") }}
              />
            </Card>
          ) : (
            <>
              {section("Clients", clientHits, <Users />)}
              {section("Houses", houseHits, <Building2 />)}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function SearchPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <React.Suspense fallback={null}>
      <SearchResults />
    </React.Suspense>
  );
}
