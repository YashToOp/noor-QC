"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAppUsers, useHouseScores, useHouses, useOrders } from "@/lib/queries";
import { searchParties } from "@/lib/search";
import { orderBook } from "@/lib/profile";
import type { House, HouseScore } from "@/lib/types";
import { formatCount, formatMoney, formatPercent, UNKNOWN } from "@/lib/format";

/**
 * HOUSES — the manufacturer list, with the scorecard numbers that decide who
 * gets the next order shown inline.
 */
export default function HousesPage() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const houses = useHouses();
  const users = useAppUsers();
  const orders = useOrders();
  const scores = useHouseScores();

  /** Most recent scorecard per house — the list ranks on the current picture. */
  const latestScore = React.useMemo(() => {
    const byHouse = new Map<string, HouseScore>();
    for (const s of scores.data ?? []) {
      if (!byHouse.has(s.house_id)) byHouse.set(s.house_id, s);
    }
    return byHouse;
  }, [scores.data]);

  const rows = React.useMemo(() => {
    const all = houses.data ?? [];
    if (!query.trim()) return all;
    const matched = new Set(
      searchParties({
        query,
        clients: [],
        houses: all,
        users: users.data ?? [],
      }).map((h) => h.id),
    );
    return all.filter((h) => matched.has(h.id));
  }, [houses.data, users.data, query]);

  const bookFor = React.useCallback(
    (houseId: string) => orderBook((orders.data ?? []).filter((o) => o.house_id === houseId)),
    [orders.data],
  );

  const currency = (orders.data ?? [])[0]?.currency ?? "USD";

  const columns: Column<House>[] = [
    {
      id: "name",
      header: "House",
      primary: true,
      render: (h) => h.name,
      sortValue: (h) => h.name,
    },
    {
      id: "code",
      header: "Code",
      render: (h) => h.code,
      sortValue: (h) => h.code,
      width: "88px",
    },
    {
      id: "location",
      header: "Location",
      render: (h) => [h.city, h.country].filter(Boolean).join(", ") || UNKNOWN,
      sortValue: (h) => h.city ?? "",
    },
    {
      id: "onTime",
      header: "On-time %",
      numeric: true,
      render: (h) => {
        const v = latestScore.get(h.id)?.on_time_pct;
        return v == null ? <span className="text-ink-disabled">—</span> : `${formatPercent(Number(v))}%`;
      },
      sortValue: (h) => Number(latestScore.get(h.id)?.on_time_pct ?? -1),
      width: "112px",
    },
    {
      id: "defect",
      header: "Defect %",
      numeric: true,
      render: (h) => {
        const v = latestScore.get(h.id)?.defect_pct;
        return v == null ? <span className="text-ink-disabled">—</span> : `${formatPercent(Number(v))}%`;
      },
      sortValue: (h) => Number(latestScore.get(h.id)?.defect_pct ?? -1),
      width: "104px",
    },
    {
      id: "orders",
      header: "Orders",
      numeric: true,
      render: (h) => formatCount(bookFor(h.id).total),
      sortValue: (h) => bookFor(h.id).total,
      width: "96px",
    },
    {
      id: "booked",
      header: "Value booked",
      numeric: true,
      render: (h) => formatMoney(bookFor(h.id).lifetimeValue, currency),
      sortValue: (h) => bookFor(h.id).lifetimeValue,
      width: "132px",
    },
  ];

  return (
    <>
      <PageHeader title="Houses" />

      <div className="my-3 flex shrink-0 items-center justify-between gap-2">
        <div className="w-[320px]">
          <Input
            size="search"
            icon={<Search />}
            placeholder="Name, code, city or phone"
            aria-label="Search houses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {houses.isError ? (
          <Card title="Houses">
            <ErrorState
              thing="the house list"
              reason={(houses.error as Error)?.message}
              onRetry={() => houses.refetch()}
            />
          </Card>
        ) : houses.isLoading ? (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : (
          <DataTable
            caption="Manufacturing houses"
            columns={columns}
            rows={rows}
            rowKey={(h) => h.id}
            onRowClick={(h) => router.push(`/houses/${h.id}`)}
            defaultSort={{ columnId: "onTime", direction: "desc" }}
            empty={
              <EmptyState
                icon={<Building2 />}
                title={query.trim() ? "No house matches" : "No houses yet"}
                description={
                  query.trim()
                    ? "Try a code, a city, or part of a phone number."
                    : "Houses are seeded into the shared project."
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
