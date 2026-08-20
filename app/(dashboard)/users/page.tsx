"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAppUsers, useClients, useDisplayCurrency, useHouses } from "@/lib/queries";
import type { AppUser } from "@/lib/types";
import { formatMoneyFull, UNKNOWN } from "@/lib/format";

/**
 * USERS & ROLES — the directory, read-only.
 *
 * `user_role` is a six-member enum and `app_users.order_value_limit` is a real
 * per-person approval ceiling, so the data behind a permissions screen exists.
 * What does not exist is auth: this build has no sign-in by design (build
 * prompt Part F), the operator is hardcoded, and RLS is off on the shared
 * project. Editing roles here would imply an enforcement that nothing checks,
 * which is worse than not offering it — so the page shows who is on the system
 * and says plainly what the roles currently do and do not control.
 */
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  staff: "Staff",
  client_principal: "Client principal",
  client_buyer: "Client buyer",
  client_accountant: "Client accountant",
  house_user: "House contact",
};

const ROLE_SCOPE: Record<string, string> = {
  owner: "Everything, including gate decisions and money",
  staff: "Day-to-day operations",
  client_principal: "Their own orders, and approves proformas in Majlis",
  client_buyer: "Their own orders in Majlis",
  client_accountant: "Their own ledger in Majlis",
  house_user: "Released orders for their house, in Sharik",
};

export default function UsersPage() {
  const router = useRouter();
  const users = useAppUsers();
  const clients = useClients();
  const houses = useHouses();
  const display = useDisplayCurrency();

  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );
  const houseById = React.useMemo(
    () => new Map((houses.data ?? []).map((h) => [h.id, h])),
    [houses.data],
  );

  const columns: Column<AppUser>[] = [
    {
      id: "name",
      header: "Person",
      primary: true,
      render: (u) => u.display_name ?? UNKNOWN,
      sortValue: (u) => u.display_name ?? "",
    },
    {
      id: "role",
      header: "Role",
      render: (u) => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {ROLE_LABEL[u.role] ?? u.role}
        </span>
      ),
      sortValue: (u) => ROLE_LABEL[u.role] ?? u.role,
      width: "180px",
    },
    {
      id: "scope",
      header: "What that covers",
      render: (u) => ROLE_SCOPE[u.role] ?? UNKNOWN,
      sortValue: (u) => ROLE_SCOPE[u.role] ?? "",
    },
    {
      id: "party",
      header: "Belongs to",
      render: (u) => {
        if (u.client_id) return clientById.get(u.client_id)?.name ?? UNKNOWN;
        if (u.house_id) return houseById.get(u.house_id)?.name ?? UNKNOWN;
        return <span className="text-ink-secondary">Noor</span>;
      },
      sortValue: (u) =>
        u.client_id
          ? clientById.get(u.client_id)?.name ?? ""
          : u.house_id
            ? houseById.get(u.house_id)?.name ?? ""
            : "Noor",
      width: "180px",
    },
    {
      id: "phone",
      header: "Phone",
      render: (u) => u.phone ?? <span className="text-ink-disabled">—</span>,
      sortValue: (u) => u.phone ?? "",
      width: "160px",
    },
    {
      id: "limit",
      header: "Approval limit",
      numeric: true,
      render: (u) =>
        u.order_value_limit == null ? (
          <span className="text-ink-disabled">—</span>
        ) : (
          formatMoneyFull(Number(u.order_value_limit), display)
        ),
      sortValue: (u) => Number(u.order_value_limit ?? 0),
      width: "148px",
    },
    {
      id: "status",
      header: "Status",
      render: (u) => (
        <StatusBadge
          spec={
            u.status === "active"
              ? { tone: "active", label: "Active" }
              : u.status === "paused"
                ? { tone: "pending", label: "Paused" }
                : { tone: "closed", label: "Archived" }
          }
          dot
        />
      ),
      sortValue: (u) => u.status,
      width: "112px",
    },
  ];

  return (
    <>
      <PageHeader title="Users & roles" />

      <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-4">
        <div className="grid grid-cols-12 items-start gap-4">
          <div className="col-span-12">
            <Card title="No sign-in in this build">
              <div className="flex items-start gap-3 rounded-lg bg-well p-3">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-state-warning" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    These roles are recorded but not enforced. This dashboard has no login — the
                    operator is hardcoded — and row-level security is off on the shared project, so
                    the anon key reads and writes everything.
                  </p>
                  <p className="mt-1 text-xs text-ink-secondary">
                    The roles and the per-person approval limits below are real data that Majlis and
                    Sharik read. Editing them here is deliberately not offered: it would imply an
                    enforcement that nothing currently checks. The production security model is in
                    docs/04-security-rls.md.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12">
            {users.isError ? (
              <Card title="Users">
                <ErrorState
                  thing="the user directory"
                  reason={(users.error as Error)?.message}
                  onRetry={() => users.refetch()}
                />
              </Card>
            ) : users.isLoading ? (
              <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
                <TableSkeleton rows={4} cols={6} />
              </div>
            ) : (
              <DataTable
                caption="People on the system and the roles they hold"
                columns={columns}
                rows={users.data ?? []}
                rowKey={(u) => u.id}
                onRowClick={(u) => {
                  if (u.client_id) router.push(`/clients/${u.client_id}`);
                  else if (u.house_id) router.push(`/houses/${u.house_id}`);
                }}
                defaultSort={{ columnId: "role", direction: "asc" }}
                empty={
                  <EmptyState
                    icon={<Users />}
                    title="Nobody on the system"
                    description="app_users holds the people Majlis and Sharik sign in as."
                  />
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
