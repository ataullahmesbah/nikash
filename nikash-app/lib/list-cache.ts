import AsyncStorage from "@react-native-async-storage/async-storage";

// Generic read-through cache for list screens (Sales/Purchases/Expenses),
// same pattern as lib/catalog.ts: try the network first so the list is
// always as fresh as possible, and only fall back to the last successful
// fetch when offline. `stale: true` tells the screen to show a small
// "অফলাইন — পুরনো তালিকা" banner instead of pretending the data is live.
export async function loadWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>
): Promise<{ data: T; stale: boolean }> {
  try {
    const data = await fetcher();
    AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
    return { data, stale: false };
  } catch (e) {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return { data: JSON.parse(cached) as T, stale: true };
    throw e;
  }
}
