import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type PickableUnit = {
  id: string; // variant_units.id
  variant_id: string;
  unit_name: string;
  purchase_price: number | null;
  sale_price: number | null;
  factor_to_base: number;
  product_name: string;
  variant_name: string;
  trackExpiry: boolean;
};

type VariantUnitRow = {
  id: string;
  variant_id: string;
  unit_name: string;
  purchase_price: number | null;
  sale_price: number | null;
  factor_to_base: number;
  product_variants: { name: string; track_expiry: boolean; products: { name: string } | null } | null;
};

function cacheKey(companyId: string) {
  return `nikash:catalog-cache:${companyId}`;
}

// The catalog is read (never written) by screens that must keep working
// offline — Stock Adjustment in particular is queued locally (lib/offline)
// and needs a product to pick from even with no signal. This is a
// read-through cache: always try the network first (freshest prices), and
// only fall back to the last successful fetch when that fails.
export async function loadCatalog(companyId: string): Promise<PickableUnit[]> {
  try {
    const { data, error } = await supabase
      .from("variant_units")
      .select(
        "id, variant_id, unit_name, purchase_price, sale_price, factor_to_base, is_active, product_variants(name, track_expiry, products(name))"
      )
      .eq("company_id", companyId)
      .eq("is_active", true)
      .limit(500);

    if (error) throw error;

    const units = ((data ?? []) as unknown as VariantUnitRow[]).map((row) => ({
      id: row.id,
      variant_id: row.variant_id,
      unit_name: row.unit_name,
      purchase_price: row.purchase_price,
      sale_price: row.sale_price,
      factor_to_base: row.factor_to_base,
      product_name: row.product_variants?.products?.name ?? "",
      variant_name: row.product_variants?.name ?? "",
      trackExpiry: row.product_variants?.track_expiry ?? false,
    }));

    AsyncStorage.setItem(cacheKey(companyId), JSON.stringify(units)).catch(() => {});
    return units;
  } catch (e) {
    const cached = await AsyncStorage.getItem(cacheKey(companyId));
    if (cached) return JSON.parse(cached) as PickableUnit[];
    throw e;
  }
}
