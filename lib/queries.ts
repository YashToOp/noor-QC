"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { deriveOpenableGates, type GateType } from "./gates";
import type {
  Approval,
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
  approvals: ["approvals"] as const,
  reviews: ["order-reviews"] as const,
};

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as T;
}

const ORDER_COLUMNS =
  "id, tenant_id, client_id, house_id, number, status, subtotal, total, currency, lead_time_days, promised_ship_date, expected_arrival_date, declined_reason, created_at, updated_at";

const EVENT_COLUMNS =
  "id, manufacturer_order_id, stage_id, status, qty_in, qty_out, expected_at, started_at, completed_at, note";

const ISSUE_COLUMNS =
  "id, issue_type_id, manufacturer_order_id, house_id, client_id, raised_at, description, status, sla_due_at, resolution, cost_impact, days_impact, resolved_at, client_visible";

const APPROVAL_COLUMNS =
  "id, manufacturer_order_id, order_line_id, type, title, swatch_ref, lighting, due_at, status, decision, reason, decided_at";

const STAGE_COLUMNS =
  "id, code, name, sort, typical_duration_days, requires_media, client_visible";

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
        supabase().from("production_stages").select(STAGE_COLUMNS).order("sort"),
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
        supabase().from("issues").select(ISSUE_COLUMNS).order("raised_at", { ascending: false }),
      ),
  });
}

export function useProductionEvents() {
  return useQuery({
    queryKey: qk.events,
    queryFn: () => must<ProductionEvent[]>(supabase().from("production_events").select(EVENT_COLUMNS)),
  });
}

/**
 * Every gate ever opened, decided or not.
 *
 * The queue only reads *open* gates, but the KPI needs the decided ones too:
 * reconstructing how many gates were pending last week means counting the ones
 * that had been opened by then and not yet decided by then, and a gate decided
 * yesterday still counted last week.
 */
export function useAllReviews() {
  return useQuery({
    queryKey: qk.reviews,
    queryFn: () => must<OrderReview[]>(supabase().from("order_reviews").select("*")),
  });
}

export function useApprovals() {
  return useQuery({
    queryKey: qk.approvals,
    queryFn: () => must<Approval[]>(supabase().from("approvals").select(APPROVAL_COLUMNS)),
  });
}

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
  /**
   * Stable row identity. Once a gate exists this is its review id, which is
   * also what /gates/[id] routes on. A gate that *should* exist but has not
   * been opened yet is keyed by order and type until `useAutoOpenGates`
   * materialises it, so the row does not jump under the cursor.
   */
  key: string;
  gateType: GateType;
  review: OrderReview | null;
  order: ManufacturerOrder;
  client: Client | null;
  house: House | null;
}

/**
 * The queue: every open gate, of every type.
 *
 * Two sources feed it. Gates that already exist are `order_reviews` rows with
 * no `decided_at`. Gates that *ought* to exist are derived from the state of
 * the world — an order that just reached `approved`, a stage the house has
 * just finished, a ladder that is now complete — and appear immediately, while
 * `useAutoOpenGates` writes the row behind them. The operator sees the work
 * the instant it lands rather than a beat later.
 */
export function useGateQueue() {
  return useQuery({
    queryKey: qk.gateQueue,
    queryFn: async (): Promise<GateRow[]> => {
      const db = supabase();

      // Every review, not just the open ones: deriveOpenableGates needs the
      // *decided* stage gates to know which completed stages are already
      // verified. Filtering to open ones here would re-raise a stage gate the
      // moment it was decided, forever.
      const [orders, allReviews, events, stages, clients, houses] = await Promise.all([
        must<ManufacturerOrder[]>(db.from("manufacturer_orders").select(ORDER_COLUMNS)),
        must<OrderReview[]>(db.from("order_reviews").select("*")),
        must<ProductionEvent[]>(db.from("production_events").select(EVENT_COLUMNS)),
        must<ProductionStage[]>(db.from("production_stages").select(STAGE_COLUMNS).order("sort")),
        must<Client[]>(db.from("clients").select("id, code, name, country, city, currency")),
        must<House[]>(db.from("houses").select("id, code, name, city, country, specialities")),
      ]);

      const orderById = new Map(orders.map((o) => [o.id, o]));
      const clientById = new Map(clients.map((c) => [c.id, c]));
      const houseById = new Map(houses.map((h) => [h.id, h]));

      const decorate = (
        order: ManufacturerOrder,
        gateType: GateType,
        review: OrderReview | null,
      ): GateRow => ({
        key: review?.id ?? `${order.id}:${gateType}`,
        gateType,
        review,
        order,
        client: order.client_id ? clientById.get(order.client_id) ?? null : null,
        house: order.house_id ? houseById.get(order.house_id) ?? null : null,
      });

      const rows: GateRow[] = [];

      for (const review of allReviews) {
        if (review.decided_at) continue; // decided gates have left the queue
        const order = orderById.get(review.manufacturer_order_id);
        if (!order) continue;
        rows.push(decorate(order, review.gate_type as GateType, review));
      }

      // Gates that should be open but have not been written yet.
      const openable = deriveOpenableGates({ orders, reviews: allReviews, events, stages });
      for (const g of openable) {
        rows.push(decorate(g.order, g.gateType, null));
      }

      return rows;
    },
    staleTime: 0,
  });
}

export interface GateDetail {
  review: OrderReview | null;
  gateType: GateType;
  order: ManufacturerOrder;
  client: Client | null;
  house: House | null;
  scores: HouseScore[];
  lines: (OrderLine & { style: Style | null; colourway: Colourway | null })[];
  limit: WorkingLimit | null;
  issues: Issue[];
  events: (ProductionEvent & { stage: ProductionStage | null })[];
  approvals: Approval[];
}

/**
 * Everything a gate detail page needs.
 *
 * Routed on the **review id**, since an order can now hold several gates at
 * once. A gate that is still being opened is addressed as `orderId:gateType`
 * so a click never lands on a dead route.
 */
export function useGateDetail(gateKey: string) {
  return useQuery({
    queryKey: qk.gate(gateKey),
    queryFn: () => fetchGateDetail(gateKey),
    enabled: Boolean(gateKey),
  });
}

async function fetchGateDetail(gateKey: string): Promise<GateDetail | null> {
  const db = supabase();

  let review: OrderReview | null = null;
  let orderId: string;
  let gateType: GateType;

  if (gateKey.includes(":")) {
    const [id, type] = gateKey.split(":");
    orderId = id;
    gateType = type as GateType;
    const rows = await must<OrderReview[]>(
      db
        .from("order_reviews")
        .select("*")
        .eq("manufacturer_order_id", orderId)
        .eq("gate_type", gateType)
        .is("decided_at", null),
    );
    review = rows[0] ?? null;
  } else {
    const rows = await must<OrderReview[]>(
      db.from("order_reviews").select("*").eq("id", gateKey),
    );
    review = rows[0] ?? null;
    if (!review) return null;
    orderId = review.manufacturer_order_id;
    gateType = review.gate_type as GateType;
  }

  const orders = await must<ManufacturerOrder[]>(
    db.from("manufacturer_orders").select(ORDER_COLUMNS).eq("id", orderId).limit(1),
  );
  const order = orders[0];
  if (!order) return null;

  const [lines, issues, events, stages, approvals] = await Promise.all([
    must<OrderLine[]>(
      db
        .from("manufacturer_order_lines")
        .select(
          "id, manufacturer_order_id, style_id, colourway_id, packs, pcs, unit_price, line_total, status",
        )
        .eq("manufacturer_order_id", orderId),
    ),
    must<Issue[]>(db.from("issues").select(ISSUE_COLUMNS).eq("manufacturer_order_id", orderId)),
    must<ProductionEvent[]>(
      db.from("production_events").select(EVENT_COLUMNS).eq("manufacturer_order_id", orderId),
    ),
    must<ProductionStage[]>(db.from("production_stages").select(STAGE_COLUMNS).order("sort")),
    must<Approval[]>(
      db.from("approvals").select(APPROVAL_COLUMNS).eq("manufacturer_order_id", orderId),
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
  const stageById = new Map(stages.map((s) => [s.id, s]));

  return {
    review,
    gateType,
    order,
    client: clients[0] ?? null,
    house: houses[0] ?? null,
    scores,
    limit: limits[0] ?? null,
    issues,
    approvals,
    lines: lines.map((l) => ({
      ...l,
      style: l.style_id ? styleById.get(l.style_id) ?? null : null,
      colourway: l.colourway_id ? colourById.get(l.colourway_id) ?? null : null,
    })),
    events: events
      .map((e) => ({ ...e, stage: stageById.get(e.stage_id) ?? null }))
      .sort((a, b) => (a.stage?.sort ?? 0) - (b.stage?.sort ?? 0)),
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
      const db = supabase();

      const orders = await must<ManufacturerOrder[]>(
        db.from("manufacturer_orders").select(ORDER_COLUMNS).eq("id", orderId).limit(1),
      );
      const order = orders[0];
      if (!order) return null;

      const [reviews, lines, issues, events, stages] = await Promise.all([
        must<OrderReview[]>(
          db
            .from("order_reviews")
            .select("*")
            .eq("manufacturer_order_id", orderId)
            .order("started_at", { ascending: false }),
        ),
        must<OrderLine[]>(
          db
            .from("manufacturer_order_lines")
            .select(
              "id, manufacturer_order_id, style_id, colourway_id, packs, pcs, unit_price, line_total, status",
            )
            .eq("manufacturer_order_id", orderId),
        ),
        must<Issue[]>(db.from("issues").select(ISSUE_COLUMNS).eq("manufacturer_order_id", orderId)),
        must<ProductionEvent[]>(
          db.from("production_events").select(EVENT_COLUMNS).eq("manufacturer_order_id", orderId),
        ),
        must<ProductionStage[]>(db.from("production_stages").select(STAGE_COLUMNS).order("sort")),
      ]);

      const styleIds = lines.map((l) => l.style_id).filter(Boolean) as string[];
      const colourIds = lines.map((l) => l.colourway_id).filter(Boolean) as string[];

      const [clients, houses, styles, colourways] = await Promise.all([
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
      ]);

      const styleById = new Map(styles.map((s) => [s.id, s]));
      const colourById = new Map(colourways.map((c) => [c.id, c]));
      const stageById = new Map(stages.map((s) => [s.id, s]));

      return {
        order,
        client: clients[0] ?? null,
        house: houses[0] ?? null,
        review: reviews[0] ?? null,
        issues,
        lines: lines.map((l) => ({
          ...l,
          style: l.style_id ? styleById.get(l.style_id) ?? null : null,
          colourway: l.colourway_id ? colourById.get(l.colourway_id) ?? null : null,
        })),
        events: events
          .map((e) => ({ ...e, stage: stageById.get(e.stage_id) ?? null }))
          .sort((a, b) => (a.stage?.sort ?? 0) - (b.stage?.sort ?? 0)),
      };
    },
    enabled: Boolean(orderId),
  });
}
