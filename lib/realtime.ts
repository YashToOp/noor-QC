"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { qk } from "./queries";
import { openGate } from "./gates";
import type { GateRow } from "./queries";

/**
 * REALTIME — docs/13-integration-contract.md, "Realtime subscriptions".
 *
 * The contract lists QC as listening to `gates` for the badge and to
 * `manufacturer_orders` for the live board. `order_reviews` (which stands in
 * for `gates`) is **not** in the `supabase_realtime` publication, and adding it
 * would be a config write on the shared project.
 *
 * It does not need to be. Noor Core is the only surface that writes
 * `order_reviews`, so a gate never appears without this dashboard putting it
 * there. What arrives from outside is the client's approval — and that is a
 * `manufacturer_orders` UPDATE, which *is* published. So:
 *
 *   Majlis approves a proforma on the phone
 *     → manufacturer_orders.status = 'approved'
 *     → this subscription fires
 *     → the queue query is invalidated and refetches
 *     → useAutoOpenGates sees an approved order with no review and opens one
 *     → the row lands in the table and the sidebar badge increments
 *
 * with no refresh, well inside the two-second budget. Realtime invalidates the
 * query; it never writes into local state.
 */
export function useRealtimeInvalidation() {
  const qc = useQueryClient();

  useEffect(() => {
    const db = supabase();

    const invalidate = (keys: readonly (readonly unknown[])[]) => {
      for (const key of keys) qc.invalidateQueries({ queryKey: key });
    };

    const channel = db
      .channel("noor-core")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manufacturer_orders" },
        (payload) => {
          const id =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id;
          invalidate([qk.gateQueue, qk.orders]);
          if (id) invalidate([qk.gate(id), qk.order(id)]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_events" },
        (payload) => {
          const orderId = (payload.new as { manufacturer_order_id?: string } | null)
            ?.manufacturer_order_id;
          // A completed stage is what opens a stage_verify gate, and the last
          // one completing is what opens a dispatch gate — so the queue has to
          // re-derive on every ladder change, not just the timeline.
          invalidate([qk.events, qk.gateQueue]);
          if (orderId) invalidate([qk.order(orderId)]);
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => {
        invalidate([qk.approvals, qk.orders, qk.gateQueue]);
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [qc]);
}

/**
 * "The gate opens automatically."
 *
 * Neither Flutter app writes `order_reviews`, and the write map gives QC
 * "creates + decides" — so this dashboard opens the gate row itself whenever
 * the world reaches a state that calls for one: an order hitting `approved`, a
 * flagged stage being completed, a ladder finishing. `deriveOpenableGates`
 * decides which; the queue query has already surfaced them as rows, so this
 * only has to write them down.
 *
 * `openGate` is idempotent twice over — it re-reads before inserting, and the
 * partial unique index refuses a duplicate open gate — so the in-flight set
 * here is just to avoid firing the same request twice while one is on the wire.
 */
export function useAutoOpenGates(rows: GateRow[] | undefined) {
  const qc = useQueryClient();
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!rows?.length) return;
    const unopened = rows.filter((r) => !r.review && !inFlight.current.has(r.key));
    if (!unopened.length) return;

    let cancelled = false;
    for (const row of unopened) inFlight.current.add(row.key);

    Promise.allSettled(unopened.map((row) => openGate(row.order, row.gateType)))
      .then(() => {
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: qk.gateQueue });
        qc.invalidateQueries({ queryKey: qk.orders });
      })
      .finally(() => {
        for (const row of unopened) inFlight.current.delete(row.key);
      });

    return () => {
      cancelled = true;
    };
  }, [rows, qc]);
}

/**
 * A ticking `Date.now()` so "Waiting" columns count up without a refetch.
 *
 * Starts at 0 and only reads the clock in an effect, so the server and the
 * first client render agree — elapsed-time cells would otherwise hydrate
 * mismatched.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return now;
}
