import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Location = { id: string; name: string; is_default: boolean };

function cacheKey(companyId: string) {
  return `nikash:locations-cache:${companyId}`;
}

// Same read-through cache pattern as lib/catalog.ts — Stock Adjustment
// needs a location to pick even offline.
export async function loadLocations(companyId: string): Promise<Location[]> {
  try {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, is_default")
      .eq("company_id", companyId);
    if (error) throw error;

    AsyncStorage.setItem(cacheKey(companyId), JSON.stringify(data ?? [])).catch(() => {});
    return data ?? [];
  } catch (e) {
    const cached = await AsyncStorage.getItem(cacheKey(companyId));
    if (cached) return JSON.parse(cached) as Location[];
    throw e;
  }
}
