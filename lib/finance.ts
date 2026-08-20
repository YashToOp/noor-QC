import { supabase } from "./supabase";
import type { CreditNote, Invoice, LedgerEntry, Payment } from "./types";

/**
 * FINANCE WRITES
 *
 * The write map gives this dashboard `invoices`, `payments` and `credit_notes`
 * outright — no other surface touches them.
 *
 * **`ledger_entries` is written alongside, and that is deliberate.** The schema
 * has no triggers at all (checked: `information_schema.triggers` is empty for
 * `public`), so nothing projects a document into the ledger automatically — the
 * seed populated both by hand. Recording an invoice without its ledger row
 * would leave the client profile's ledger tab disagreeing with its balance
 * card, which is exactly the kind of quiet divergence that destroys trust in a
 * finance screen. The ledger is not in the contract's write map because no
 * other app writes it either; it belongs to whoever writes the documents.
 *
 * Sign convention, taken from the seeded rows: an invoice raises the balance,
 * a payment and a credit note reduce it.
 */

export type DocumentKind = "invoice" | "payment" | "credit_note";

const LEDGER_SIGN: Record<DocumentKind, 1 | -1> = {
  invoice: 1,
  payment: -1,
  credit_note: -1,
};

/**
 * Next document number in the `PREFIX-YYYY-NNNN` shape the seed uses, derived
 * from the highest existing number rather than from a count — deleting a row
 * must never hand the next document a number that was already used.
 */
export function nextDocumentNumber(prefix: string, existing: string[], year: number): string {
  const pattern = new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`);
  let highest = 0;
  for (const n of existing) {
    const m = pattern.exec(n);
    if (m && Number(m[1]) === year) highest = Math.max(highest, Number(m[2]));
  }
  return `${prefix}-${year}-${String(highest + 1).padStart(4, "0")}`;
}

async function postLedger(args: {
  tenantId: string;
  clientId: string;
  kind: DocumentKind;
  refId: string;
  amount: number;
  currency: string;
  occurredAt: string;
  description: string;
}): Promise<void> {
  const { error } = await supabase()
    .from("ledger_entries")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      kind: args.kind,
      ref_type: args.kind,
      ref_id: args.refId,
      amount: LEDGER_SIGN[args.kind] * Math.abs(args.amount),
      currency: args.currency,
      occurred_at: args.occurredAt,
      description: args.description,
    });
  if (error) throw error;
}

/**
 * The document lands first, then its ledger row.
 *
 * PostgREST has no cross-table transaction, so the order matters: a document
 * with no ledger row is visible and reconcilable, while a ledger row pointing
 * at a document that does not exist is a phantom balance. If the second write
 * fails the caller is told, and the ledger can be posted again — the document
 * id it references is already stable.
 */
export async function recordInvoice(args: {
  tenantId: string;
  clientId: string;
  orderId: string | null;
  number: string;
  amount: number;
  currency: string;
  issuedAt: string;
  dueAt: string | null;
  description: string;
}): Promise<Invoice> {
  const { data, error } = await supabase()
    .from("invoices")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      manufacturer_order_id: args.orderId,
      number: args.number,
      amount: args.amount,
      currency: args.currency,
      issued_at: args.issuedAt,
      due_at: args.dueAt,
    })
    .select("*")
    .single();
  if (error) throw error;

  await postLedger({
    tenantId: args.tenantId,
    clientId: args.clientId,
    kind: "invoice",
    refId: (data as Invoice).id,
    amount: args.amount,
    currency: args.currency,
    occurredAt: args.issuedAt,
    description: args.description,
  });

  return data as Invoice;
}

export async function recordPayment(args: {
  tenantId: string;
  clientId: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  receivedAt: string;
}): Promise<Payment> {
  const { data, error } = await supabase()
    .from("payments")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      amount: args.amount,
      currency: args.currency,
      method: args.method,
      reference: args.reference,
      received_at: args.receivedAt,
    })
    .select("*")
    .single();
  if (error) throw error;

  await postLedger({
    tenantId: args.tenantId,
    clientId: args.clientId,
    kind: "payment",
    refId: (data as Payment).id,
    amount: args.amount,
    currency: args.currency,
    occurredAt: args.receivedAt,
    description: [args.method, args.reference].filter(Boolean).join(" — ") || "Payment received",
  });

  return data as Payment;
}

export async function recordCreditNote(args: {
  tenantId: string;
  clientId: string;
  orderId: string | null;
  issueId: string | null;
  number: string;
  amount: number;
  currency: string;
  reason: string;
  issuedAt: string;
}): Promise<CreditNote> {
  const { data, error } = await supabase()
    .from("credit_notes")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      manufacturer_order_id: args.orderId,
      issue_id: args.issueId,
      number: args.number,
      amount: args.amount,
      currency: args.currency,
      reason: args.reason,
      issued_at: args.issuedAt,
    })
    .select("*")
    .single();
  if (error) throw error;

  await postLedger({
    tenantId: args.tenantId,
    clientId: args.clientId,
    kind: "credit_note",
    refId: (data as CreditNote).id,
    amount: args.amount,
    currency: args.currency,
    occurredAt: args.issuedAt,
    description: args.reason,
  });

  return data as CreditNote;
}

/** Running balance over a ledger, oldest first. */
export function runningBalance(entries: LedgerEntry[]): { entry: LedgerEntry; balance: number }[] {
  const oldestFirst = [...entries].sort(
    (a, b) => new Date(a.occurred_at ?? 0).getTime() - new Date(b.occurred_at ?? 0).getTime(),
  );
  let balance = 0;
  return oldestFirst.map((entry) => {
    balance += Number(entry.amount ?? 0);
    return { entry, balance };
  });
}

/** `YYYY-MM-DD` for a date input and for the `date` columns these tables use. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
