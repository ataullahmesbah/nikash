import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { getOldestPendingAge, getPendingCount, processSyncQueue } from "./sync-queue";

const FIVE_MINUTES = 5 * 60 * 1000;
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [oldestPendingAt, setOldestPendingAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const [count, oldest] = await Promise.all([getPendingCount(), getOldestPendingAge()]);
    if (!mounted.current) return;
    setPendingCount(count);
    setOldestPendingAt(oldest);
  }, []);

  const syncNow = useCallback(async () => {
    await processSyncQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    syncNow(); // sync on app open (PRD 18: "অ্যাপ খুললে")

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) syncNow(); // "ইন্টারনেট ফিরলে"
    });

    const interval = setInterval(syncNow, FIVE_MINUTES); // "প্রতি ৫ মিনিটে"

    return () => {
      mounted.current = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [refresh, syncNow]);

  const staleForTwoDays =
    oldestPendingAt !== null && Date.now() - oldestPendingAt.getTime() > TWO_DAYS;

  return { isOnline, pendingCount, staleForTwoDays, syncNow, refresh };
}
