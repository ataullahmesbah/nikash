import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "offline";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// PRD 20.3: duration per type, max 3 toasts on screen at once, reversible
// actions get an "Undo" button. `message` should stay under ~60 chars —
// this is a UI convention, not enforced here.
const DURATION: Record<ToastType, number> = {
  success: 2000,
  info: 2000,
  warning: 3000,
  error: 4000,
  offline: 0, // persistent — caller must dismiss explicitly
};

const MAX_VISIBLE = 3;

type ToastContextValue = {
  toasts: ToastItem[];
  show: (type: ToastType, message: string, opts?: { actionLabel?: string; onAction?: () => void }) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, opts?: { actionLabel?: string; onAction?: () => void }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: ToastItem = { id, type, message, ...opts };

      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), item]);

      const duration = DURATION[type];
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  // ⚠️ value অবজেক্টটা useMemo ছাড়া দিলে প্রতি রেন্ডারে নতুন হয়ে যায়,
  // আর তখন প্রতিটি consumer-ও রেন্ডার হয়। show/dismiss দুটোই useCallback
  // দিয়ে স্থির, তাই টোস্টের তালিকা বদলালেই কেবল নতুন value হবে।
  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * ⚠️ ফেরত দেওয়া অবজেক্টটা অবশ্যই স্থির (stable) থাকতে হবে।
 *
 * স্ক্রিনগুলো এভাবে লেখে:
 *
 *     const load = useCallback(async () => { ... }, [profile, tab, toast]);
 *     useFocusEffect(useCallback(() => { load(); }, [load]));
 *
 * আগে এখানে প্রতিবার নতুন অবজেক্ট লিটারাল ফেরত যেত। ফলে প্রতি রেন্ডারে
 * `toast` নতুন → `load` নতুন → focus effect আবার চলে → setLoading(true)
 * → আবার রেন্ডার → অসীম লুপ। বাকির হিসাবে পুল-টু-রিফ্রেশের স্পিনারটা
 * তাই কখনো থামত না, আর প্রতিবার ডেটাবেজেও কল যেত।
 *
 * show ও dismiss দুটোই useCallback দিয়ে স্থির, তাই এই useMemo আসলে
 * অ্যাপের পুরো জীবনে একবারই চলে।
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");

  const { show, dismiss } = ctx;

  return useMemo(
    () => ({
      success: (message: string) => show("success", message),
      error: (message: string) => show("error", message),
      warning: (message: string) => show("warning", message),
      info: (message: string) => show("info", message),
      // Reversible action: shows an "Undo" button for 5s (PRD's own example).
      withUndo: (message: string, onUndo: () => void) =>
        show("success", message, { actionLabel: "পূর্বাবস্থায় ফিরুন", onAction: onUndo }),
      dismiss,
    }),
    [show, dismiss]
  );
}

export function useToastList() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastList must be used within ToastProvider");
  return ctx;
}