"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAppUsers, useClients, useOrders } from "@/lib/queries";
import { searchParties } from "@/lib/search";
import { orderBook } from "@/lib/profile";
import type { Client } from "@/lib/types";
import { formatCount, formatMoney, UNKNOWN } from "@/lib/format";

/**
 * CLIENTS — the party list, searchable on the same fields as the global box:
 * name, code, id, city and phone (which resolves through `app_users`).
 */
export default function ClientsPage() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const clients = useClients();
  const users = useAppUsers();
  const orders = useOrders();

  const rows = React.useMemo(() => {
    const all = clients.data ?? [];
    if (!query.trim()) return all;
    const matched = new Set(
      searchParties({
        query,
        clients: all,
        houses: [],
        users: users.data ?? [],
      }).map((h) => h.id),
    );
    return all.filter((c) => matched.has(c.id));
  }, [clients.data, users.data, query]);

  const bookFor = React.useCallback(
    (clientId: string) => orderBook((orders.data ?? []).filter((o) => o.client_id === clientId)),
    [orders.data],
  );

  const phoneFor = React.useCallback(
    (clientId: string) =>
      (users.data ?? []).find((u) => u.client_id === clientId && u.phone)?.phone ?? null,
    [users.data],
  );

  const columns: Column<Client>[] = [
    {
      id: "name",
      header: "Client",
      primary: true,
      render: (c) => c.name,
      sortValue: (c) => c.name,
    },
    {
      id: "code",
      header: "Code",
      render: (c) => c.code,
      sortValue: (c) => c.code,
      width: "104px",
    },
    {
      id: "location",
      header: "Location",
      render: (c) => [c.city, c.country].filter(Boolean).join(", ") || UNKNOWN,
      sortValue: (c) => c.country ?? "",
    },
    {
      id: "phone",
      header: "Phone",
      render: (c) => phoneFor(c.id) ?? <span className="text-ink-disabled">—</span>,
      sortValue: (c) => phoneFor(c.id) ?? "",
      width: "160px",
    },
    {
      id: "orders",
      header: "Orders",
      numeric: true,
      render: (c) => formatCount(bookFor(c.id).total),
      sortValue: (c) => bookFor(c.id).total,
      width: "96px",
    },
    {
      id: "live",
      header: "Live value",
      numeric: true,
      render: (c) => formatMoney(bookFor(c.id).liveValue, c.currency ?? "USD"),
      sortValue: (c) => bookFor(c.id).liveValue,
      width: "120px",
    },
    {
      id: "lifetime",
      header: "Lifetime value",
      numeric: true,
      render: (c) => formatMoney(bookFor(c.id).lifetimeValue, c.currency ?? "USD"),
      sortValue: (c) => bookFor(c.id).lifetimeValue,
      width: "140px",
    },
  ];

  return (
    <>
      <PageHeader title="Clients" />

      <div className="my-3 flex shrink-0 items-center justify-between gap-2">
        <div className="w-[320px]">
          <Input
            size="search"
            icon={<Search />}
            placeholder="Name, code, city or phone"
            aria-label="Search clients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {clients.isError ? (
          <Card title="Clients">
            <ErrorState
              thing="the client list"
              reason={(clients.error as Error)?.message}
              onRetry={() => clients.refetch()}
            />
          </Card>
        ) : clients.isLoading ? (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : (
          <DataTable
            caption="Clients"
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/clients/${c.id}`)}
            defaultSort={{ columnId: "name", direction: "asc" }}
            empty={
              <EmptyState
                icon={<Users />}
                title={query.trim() ? "No client matches" : "No clients yet"}
                description={
                  query.trim()
                    ? "Try a code, a city, or part of a phone number."
                    : "Clients are seeded into the shared project."
                }
                action={
                  query.trim() ? { label: "Clear search", onClick: () => setQuery("") } : undefined
                }
              />
            }
          />
        )}
      </div>
    </>
  );
}
