"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { AWAITING_STATUSES } from "./gates";
import type {
  Client,
  Colourway,
  House,
  HouseScore,
  Issue,
  IssueType,
  ManufacturerOrder,
  OrderLine,
  OrderReview,
  ProductionEvent,
  ProductionStage,
  Style,
  Tenant,
  WorkingLimit,
} from "./types";

/** Query keys. Realtime invalidates these — it never writes into local state. */
export const qk = {
  tenant: ["tenant"] as const,
  gateQueue: ["gate-queue"] as const,
  gate: (id: string) => ["gate", id] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["order", id] as const,
  stages: ["production-stages"] as const,
  houses: ["houses"] as const,
  houseScores: ["house-scores"] as const,
  issues: ["issues"] as const,
  issueTypes: ["issue-types"] as const,
  events: ["production-events"] as const,
};

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as T;
}

export function useTenant() {
  return useQuery({
    queryKey: qk.tenant,
    queryFn: () =>
      must<Tenant[]>(supabase().from("tenants").select("id, slug, name, name_ar").limit(1)),
    select: (rows) => rows[0] ?? null,
    staleTime: 5 * 60_000,
  });
}

export function useProductionStages() {
  return useQuery({
    queryKey: qk.stages,
    queryFn: () =>
      must<ProductionStage[]>(
        supabase()
          .from("production_stages")
          .select("id, code, name, sort, typical_duration_days, requires_media, client_visible")
          .order("sort"),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useHouses() {
  return useQuery({
    queryKey: qk.houses,
    queryFn: () =>
      must<House[]>(
        supabase().from("houses").select("id, code, name, city, country, specialities").order("name"),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useHouseScores() {
  return useQuery({
    queryKey: qk.houseScores,
    queryFn: () =>
      must<HouseScore[]>(
        supabase()
          .from("house_scores")
          .select(
            "house_id, period_start, period_end, on_time_pct, defect_pct, avg_approval_turnaround_hours, orders_count",
          )
          .order("period_end", { ascending: false }),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useIssueTypes() {
  return useQuery({
    queryKey: qk.issueTypes,
    queryFn: () =>
      must<IssueType[]>(
        supabase().from("issue_types").select("id, category, code, name, sla_hours"),
      ),
    staleTime: 5 * 60_000,
  });
}

export function useIssues() {
  return useQuery({
    queryKey: qk.issues,
    queryFn: () =>
      must<Issue[]>(
        supabase()
          .from("issues")
          .select(
            "id, issue_type_id, manufacturer_order_id, house_id, client_id, raised_at, description, status, sla_due_at, resolution, cost_impact, days_impact, resolved_at, client_visible",
          )
          .order("raised_at", { ascending: false }),
      ),
  });
}

export function useProductionEvents() {
  return useQuery({
    queryKey: qk.events,
    queryFn: () =>
      must<ProductionEvent[]>(
        supabase()
          .from("production_events")
          .select(
            "id, manufacturer_order_id, stage_id, status, qty_in, qty_out, expected_at, started_at, completed_at, note",
          ),
      ),
  });
}

const ORDER_COLUMNS =
  "id, tenant_id, client_id, house_id, number, status, subtotal, total, currency, lead_time_days, promised_ship_date, expected_arrival_date, declined_reason, created_at, updated_at";

/** Every order, for the live board and for the dashboard's derived measures. */
export function useOrders() {
  return useQuery({
    queryKey: qk.orders,
    queryFn: () =>
      must<ManufacturerOrder[]>(
        supabase()
          .from("manufacturer_orders")
          .select(ORDER_COLUMNS)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"] as const,
    queryFn: () =>
      must<Client[]>(
        supabase().from("clients").select("id, code, name, country, city, currency").order("name"),
      ),
    staleTime: 5 * 60_000,
  });
}

export interface GateRow {
  review: OrderReview | null;
  order: ManufacturerOrder;
  client: Client | null;
  house: House | null;
}

/**
 * The queue: orders sitting at `approved` or `in_review`, with their review
 * row if one has been opened. Sorted oldest-waiting-first by the caller.
 */
export function useGateQueue() {
  return useQuery({
    queryKey: qk.gateQueue,
    queryFn: async (): Promise<GateRow[]> => {
      const db = supabase();
      const orders = await must<ManufacturerOrder[]>(
        db
          .from("manufacturer_orders")
          .select(ORDER_COLUMNS)
          .in("status", AWAITING_STATUSES as unknown as string[]),
      );
      if (!orders.length) return [];

      const ids = orders.map((o) => o.id);
      const [reviews, clients, houses] = await Promise.all([
        must<OrderReview[]>(
          db.from("order_reviews").select("*").in("manufacturer_order_id", ids),
        ),
        must<Client[]>(db.from("clients").select("id, code, name, country, city, currency")),
        must<House[]>(db.from("houses").select("id, code, name, city, country, specialities")),
      ]);

      const byOrder = new Map(reviews.map((r) => [r.manufacturer_order_id, r]));
      const clientById = new Map(clients.map((c) => [c.id, c]));
      const houseById = new Map(houses.map((h) => [h.id, h]));

      return orders.map((order) => ({
        order,
        review: byOrder.get(order.id) ?? null,
        client: order.client_id ? clientById.get(order.client_id) ?? null : null,
        house: order.house_id ? houseById.get(order.house_id) ?? null : null,
      }));
    },
    // Waiting times are relative to now; keep the data itself fresh via realtime.
    staleTime: 0,
  });
}

export interface GateDetail {
  order: ManufacturerOrder;
  review: OrderReview | null;
  client: Client | null;
  house: House | null;
  scores: HouseScore[];
  lines: (OrderLine & { style: Style | null; colourway: Colourway | null })[];
  limit: WorkingLimit | null;
  issues: Issue[];
}

/** Everything the gate detail page needs, in one round of parallel reads. */
export function useGateDetail(orderId: string) {
  return useQuery({
    queryKey: qk.gate(orderId),
    queryFn: () => fetchGateDetail(orderId),
    enabled: Boolean(orderId),
  });
}

async function fetchGateDetail(orderId: string): Promise<GateDetail | null> {
  const db = supabase();
  const orders = await must<ManufacturerOrder[]>(
    db.from("manufacturer_orders").select(ORDER_COLUMNS).eq("id", orderId).limit(1),
  );
  const order = orders[0];
  if (!order) return null;

  const [reviews, lines, issues] = await Promise.all([
    must<OrderReview[]>(
      db.from("order_reviews").select("*").eq("manufacturer_order_id", orderId),
    ),
    must<OrderLine[]>(
      db
        .from("manufacturer_order_lines")
        .select(
          "id, manufacturer_order_id, style_id, colourway_id, packs, pcs, unit_price, line_total, status",
        )
        .eq("manufacturer_order_id", orderId),
    ),
    must<Issue[]>(
      db
        .from("issues")
        .select(
          "id, issue_type_id, manufacturer_order_id, house_id, client_id, raised_at, description, status, sla_due_at, resolution, cost_impact, days_impact, resolved_at, client_visible",
        )
        .eq("manufacturer_order_id", orderId),
    ),
  ]);

  const styleIds = lines.map((l) => l.style_id).filter(Boolean) as string[];
  const colourIds = lines.map((l) => l.colourway_id).filter(Boolean) as string[];

  const [clients, houses, styles, colourways, scores, limits] = await Promise.all([
    order.client_id
      ? must<Client[]>(
          db
            .from("clients")
            .select("id, code, name, country, city, currency")
            .eq("id", order.client_id),
        )
      : Promise.resolve([] as Client[]),
    order.house_id
      ? must<House[]>(
          db
            .from("houses")
            .select("id, code, name, city, country, specialities")
            .eq("id", order.house_id),
        )
      : Promise.resolve([] as House[]),
    styleIds.length
      ? must<Style[]>(
          db
            .from("styles")
            .select("id, code, name, fabric, composition, lead_time_days, moq_packs, base_price")
            .in("id", styleIds),
        )
      : Promise.resolve([] as Style[]),
    colourIds.length
      ? must<Colourway[]>(
          db
            .from("colourways")
            .select("id, style_id, name, hex, colour_family, moq_packs")
            .in("id", colourIds),
        )
      : Promise.resolve([] as Colourway[]),
    order.house_id
      ? must<HouseScore[]>(
          db
            .from("house_scores")
            .select(
              "house_id, period_start, period_end, on_time_pct, defect_pct, avg_approval_turnaround_hours, orders_count",
            )
            .eq("house_id", order.house_id)
            .order("period_end", { ascending: false }),
        )
      : Promise.resolve([] as HouseScore[]),
    order.client_id
      ? must<WorkingLimit[]>(
          db
            .from("working_limits")
            .select("id, client_id, season, amount, currency, committed, status")
            .eq("client_id", order.client_id),
        )
      : Promise.resolve([] as WorkingLimit[]),
  ]);

  const styleById = new Map(styles.map((s) => [s.id, s]));
  const colourById = new Map(colourways.map((c) => [c.id, c]));

  return {
    order,
    review: reviews[0] ?? null,
    client: clients[0] ?? null,
    house: houses[0] ?? null,
    scores,
    limit: limits[0] ?? null,
    issues,
    lines: lines.map((l) => ({
      ...l,
      style: l.style_id ? styleById.get(l.style_id) ?? null : null,
      colourway: l.colourway_id ? colourById.get(l.colourway_id) ?? null : null,
    })),
  };
}

export interface OrderDetail {
  order: ManufacturerOrder;
  client: Client | null;
  house: House | null;
  review: OrderReview | null;
  lines: (OrderLine & { style: Style | null; colourway: Colourway | null })[];
  events: (ProductionEvent & { stage: ProductionStage | null })[];
  issues: Issue[];
}

/**
 * Order detail fetches its own data rather than reading the gate query's
 * cache. Sharing that cache through a closure would let the two go out of
 * step: this query's key does not change when the gate query refetches, so a
 * realtime invalidation could re-run this body against a stale closure.
 */
export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: qk.order(orderId),
    queryFn: async (): Promise<OrderDetail | null> => {
      const [detail, stages, events] = await Promise.all([
        fetchGateDetail(orderId),
        must<ProductionStage[]>(
          supabase()
            .from("production_stages")
            .select("id, code, name, sort, typical_duration_days, requires_media, client_visible")
            .order("sort"),
        ),
        must<ProductionEvent[]>(
          supabase()
            .from("production_events")
            .select(
              "id, manufacturer_order_id, stage_id, status, qty_in, qty_out, expected_at, started_at, completed_at, note",
            )
            .eq("manufacturer_order_id", orderId),
        ),
      ]);
      if (!detail) return null;

      const stageById = new Map(stages.map((s) => [s.id, s]));
      return {
        order: detail.order,
        client: detail.client,
        house: detail.house,
        review: detail.review,
        lines: detail.lines,
        issues: detail.issues,
        events: events
          .map((e) => ({ ...e, stage: stageById.get(e.stage_id) ?? null }))
          .sort((a, b) => (a.stage?.sort ?? 0) - (b.stage?.sort ?? 0)),
      };
    },
    enabled: Boolean(orderId),
  });
}
