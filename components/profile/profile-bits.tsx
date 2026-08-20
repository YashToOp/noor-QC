"use client";

import * as React from "react";
import { AlertTriangle, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { UNKNOWN } from "@/lib/format";
import type { AppUser } from "@/lib/types";

/** A label/value pair, used throughout both profiles. */
export function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-secondary">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block truncate font-medium text-ink">{value}</span>
        {hint && <span className="block text-xs text-ink-secondary">{hint}</span>}
      </dd>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  staff: "Staff",
  client_principal: "Principal",
  client_buyer: "Buyer",
  client_accountant: "Accountant",
  house_user: "House contact",
};

/**
 * Contacts — the only place a phone number lives in this schema, which is also
 * what makes a phone search resolve to a party.
 */
export function ContactCard({ contacts }: { contacts: AppUser[] }) {
  return (
    <Card title="Contacts">
      {contacts.length === 0 ? (
        <EmptyState
          icon={<User />}
          title="No contacts on record"
          description="Phone numbers live on app_users. Nobody is linked to this party yet, so it cannot be found by phone."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-well text-sm font-medium text-ink-secondary"
                aria-hidden
              >
                {(c.display_name ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {c.display_name ?? UNKNOWN}
                </span>
                <span className="truncate text-xs text-ink-secondary">
                  {ROLE_LABEL[c.role] ?? c.role}
                </span>
              </span>
              {c.phone ? (
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-sm tabular-nums text-ink-secondary hover:text-ink"
                >
                  <Phone className="size-3.5 shrink-0 text-ink-sub" aria-hidden />
                  {c.phone}
                </a>
              ) : (
                <span className="shrink-0 text-ink-disabled">—</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * A card explaining that a section has nothing behind it in this schema —
 * used where the honest answer is "the database does not record this", which
 * is different from "there is no data yet".
 */
export function NotRecorded({
  title,
  what,
  why,
}: {
  title: string;
  what: string;
  why: string;
}) {
  return (
    <Card title={title}>
      <div className="rounded-lg bg-well p-3">
        <p className="text-sm font-medium text-ink">{what}</p>
        <p className="mt-1 text-xs text-ink-secondary">{why}</p>
      </div>
    </Card>
  );
}

/**
 * Totals only mean something when every row shares a currency.
 *
 * The demo data is mid-conversion from USD to INR — most rows moved, a few did
 * not — so any sum across them is adding two different units. Rather than
 * silently produce a meaningless number, the pages that total money say so
 * when they see more than one currency.
 */
export function MixedCurrencyNotice({
  currencies,
  display,
}: {
  currencies: string[];
  display: string;
}) {
  const distinct = Array.from(new Set(currencies.filter(Boolean)));
  if (distinct.length < 2) return null;

  const others = distinct.filter((c) => c !== display);
  return (
    <div className="col-span-12 flex items-start gap-2 rounded-lg border-hairline border-line bg-well p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-state-warning" aria-hidden />
      <p className="text-xs text-ink-secondary">
        <span className="font-medium text-ink">Totals mix currencies. </span>
        These records are not all in {display} — {others.join(", ")} also appears — so the sums
        below add different units and are not meaningful until the data is on one currency.
      </p>
    </div>
  );
}
