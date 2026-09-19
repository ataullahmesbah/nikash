import { useEffect, useMemo, useState } from "react";
import { Stack } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { loadCatalog, type PickableUnit } from "@/lib/catalog";
import { PrimaryButton } from "@/components/form";
import CloseShiftModal from "./close-shift-modal";
import type { ActiveShift } from "../index";

type CartLine = { unit: PickableUnit; qty: number };

export default function PosScreen({ shift, onClosed }: { shift: ActiveShift; onClosed: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState<PickableUnit[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cashReceived, setCashReceived] = useState("");
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadCatalog(profile.company_id).then(setCatalog).catch(() => {});
  }, [profile]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (u) => u.product_name.toLowerCase().includes(needle) || u.variant_name.toLowerCase().includes(needle)
    );
  }, [catalog, search]);

  const total = cart.reduce((sum, l) => sum + l.qty * (l.unit.sale_price ?? 0), 0);
  const change = Math.max(0, (Number(cashReceived) || 0) - total);

  function addToCart(unit: PickableUnit) {
    setCart((prev) => {
      const existing = prev.find((l) => l.unit.id === unit.id);
      if (existing) {
        return prev.map((l) => (l.unit.id === unit.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { unit, qty: 1 }];
    });
  }

  function changeQty(unitId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.unit.id === unitId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }

  async function handleCheckout() {
    if (!profile || cart.length === 0) return;
    setCheckingOut(true);
    try {
      const saleId = Crypto.randomUUID();
      const { data: invoiceNo, error: docNoErr } = await supabase.rpc("next_doc_no", {
        p_company: profile.company_id,
        p_type: "sale",
        p_prefix: "POS",
      });
      if (docNoErr) throw docNoErr;

      const { error: saleErr } = await supabase.from("sales").insert({
        id: saleId,
        company_id: profile.company_id,
        invoice_no: invoiceNo,
        is_walk_in: true,
        walk_in_name: "নগদ ক্রেতা (POS)",
        subtotal: total,
        discount: 0,
        total,
        paid: total,
        due: 0,
        status: "draft",
        created_by: profile.id,
      });
      if (saleErr) throw saleErr;

      const itemRows = cart.map((l) => ({
        company_id: profile.company_id,
        sale_id: saleId,
        variant_id: l.unit.variant_id,
        unit_id: l.unit.id,
        qty: l.qty,
        qty_base: l.qty * l.unit.factor_to_base,
        unit_price: l.unit.sale_price ?? 0,
        total: l.qty * (l.unit.sale_price ?? 0),
      }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(itemRows);
      if (itemsErr) throw itemsErr;

      const { error: postErr } = await supabase.rpc("post_sale", { p_sale: saleId });
      if (postErr) throw postErr;

      toast.success(`বিক্রয় সম্পন্ন — ৳${total} · ফেরত ৳${change.toFixed(0)}`);
      setCart([]);
      setCashReceived("");
    } catch (e) {
      toast.error(e instanceof Error && e.message.length <= 60 ? e.message : "বিক্রয় ব্যর্থ হয়েছে");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "POS",
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => setShowCloseShift(true)}>
              <Text style={{ color: "#dc2626", fontWeight: "700" }}>শিফট শেষ</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.body}>
        <View style={styles.gridSection}>
          <TextInput
            style={styles.search}
            placeholder="প্রোডাক্ট খুঁজুন..."
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
            renderItem={({ item }) => (
              <Pressable style={styles.tile} onPress={() => addToCart(item)}>
                <Text style={styles.tileName} numberOfLines={2}>
                  {item.product_name}
                </Text>
                <Text style={styles.tileVariant} numberOfLines={1}>
                  {item.variant_name}
                </Text>
                <Text style={styles.tilePrice}>৳{item.sale_price ?? 0}</Text>
              </Pressable>
            )}
          />
        </View>

        <View style={styles.cartSection}>
          <Text style={styles.cartTitle}>কার্ট</Text>
          <FlatList
            data={cart}
            keyExtractor={(l) => l.unit.id}
            ListEmptyComponent={<Text style={styles.emptyCart}>প্রোডাক্টে ট্যাপ করুন</Text>}
            renderItem={({ item }) => (
              <View style={styles.cartRow}>
                <Text style={styles.cartRowName} numberOfLines={1}>
                  {item.unit.product_name}
                </Text>
                <View style={styles.qtyStepper}>
                  <Pressable onPress={() => changeQty(item.unit.id, -1)} style={styles.stepBtn}>
                    <Text style={styles.stepText}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <Pressable onPress={() => changeQty(item.unit.id, 1)} style={styles.stepBtn}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.cartRowTotal}>৳{item.qty * (item.unit.sale_price ?? 0)}</Text>
              </View>
            )}
          />

          <View style={styles.checkoutBox}>
            <Text style={styles.totalText}>মোট: ৳{total.toFixed(0)}</Text>
            <TextInput
              style={styles.search}
              placeholder="কত টাকা দিয়েছে?"
              keyboardType="numeric"
              value={cashReceived}
              onChangeText={setCashReceived}
            />
            {cashReceived !== "" && <Text style={styles.changeText}>ফেরত: ৳{change.toFixed(0)}</Text>}
            <PrimaryButton
              title="বিক্রয় সম্পন্ন করুন"
              onPress={handleCheckout}
              loading={checkingOut}
              disabled={cart.length === 0}
              tone="success"
            />
          </View>
        </View>
      </View>

      <CloseShiftModal
        visible={showCloseShift}
        shift={shift}
        onClose={() => setShowCloseShift(false)}
        onClosed={() => {
          setShowCloseShift(false);
          onClosed();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: "row" },
  gridSection: { flex: 2, padding: 12 },
  cartSection: { flex: 1, backgroundColor: "#f8fafc", padding: 12, borderLeftWidth: 1, borderLeftColor: "#e2e8f0" },
  search: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    minHeight: 80,
    justifyContent: "center",
  },
  tileName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  tileVariant: { fontSize: 11, color: "#64748b", marginTop: 2 },
  tilePrice: { fontSize: 14, fontWeight: "800", color: "#059669", marginTop: 6 },
  cartTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptyCart: { textAlign: "center", color: "#94a3b8", marginTop: 20, fontSize: 12 },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    gap: 6,
  },
  cartRowName: { flex: 1, fontSize: 12, fontWeight: "600", color: "#0f172a" },
  qtyStepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  stepText: { fontWeight: "700", color: "#0f172a" },
  qtyText: { fontSize: 12, fontWeight: "700", minWidth: 18, textAlign: "center" },
  cartRowTotal: { fontSize: 12, fontWeight: "700", color: "#0f172a", minWidth: 50, textAlign: "right" },
  checkoutBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12 },
  totalText: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  changeText: { fontSize: 13, fontWeight: "700", color: "#059669", marginBottom: 8 },
});
