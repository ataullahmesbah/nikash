import { supabase } from "./supabase";

export type FefoBatch = {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  qty_base_remaining: number;
};

// PRD's FEFO (First-Expired-First-Out) rule for sale-side stock deduction.
// Batches with no expiry_date sort last — an untracked/old batch should
// never jump ahead of one that's actually expiring soon.
export async function loadFefoBatches(companyId: string, variantId: string): Promise<FefoBatch[]> {
  const { data } = await supabase
    .from("batches")
    .select("id, batch_no, expiry_date, qty_base_remaining")
    .eq("company_id", companyId)
    .eq("variant_id", variantId)
    .gt("qty_base_remaining", 0)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  return data ?? [];
}

export type FefoChunk = { batchId: string; batchNo: string; expiryDate: string | null; qtyBase: number };
export type FefoAllocation = { chunks: FefoChunk[]; shortfallQtyBase: number };

// Greedily consumes the earliest-expiring batches first until qtyBaseNeeded
// is covered. Any amount left uncovered (shortfallQtyBase > 0) means the
// tracked batches don't have enough stock — that portion is sold without a
// batch_id, same as before this feature existed, rather than blocking the
// sale over a batch-tracking gap.
export function allocateFefo(batches: FefoBatch[], qtyBaseNeeded: number): FefoAllocation {
  const chunks: FefoChunk[] = [];
  let remaining = qtyBaseNeeded;

  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.qty_base_remaining);
    if (take > 0) {
      chunks.push({ batchId: b.id, batchNo: b.batch_no, expiryDate: b.expiry_date, qtyBase: take });
      remaining -= take;
    }
  }

  return { chunks, shortfallQtyBase: Math.max(0, remaining) };
}
