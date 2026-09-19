import { File, Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// PRD 18 rule #6 — "দৈনিক লোকাল ব্যাকআপ ফাইল, শেয়ারযোগ্য". Note on scope:
// the local SQLite in this app (lib/offline) is a write-outbox, not a full
// mirror of server data — so this backup is a fresh JSON export pulled from
// Supabase (last 90 days, matching the PRD's local-retention window), saved
// to the device and shareable. It is a safety-net snapshot, not a substitute
// for the server's own nightly pg_dump.
async function buildBackupPayload(companyId: string, companyName: string) {
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const fromStr = from.toISOString().slice(0, 10);

  const [parties, products, sales, purchases, expenses, payments] = await Promise.all([
    supabase.from("parties").select("id,name,type,phone,opening_balance,status").eq("company_id", companyId).limit(2000),
    supabase.from("products").select("id,name,brand").eq("company_id", companyId).limit(2000),
    supabase
      .from("sales")
      .select("id,invoice_no,entry_date,total,due,status")
      .eq("company_id", companyId)
      .gte("entry_date", fromStr)
      .limit(2000),
    supabase
      .from("purchases")
      .select("id,invoice_no,entry_date,total,due,status")
      .eq("company_id", companyId)
      .gte("entry_date", fromStr)
      .limit(2000),
    supabase
      .from("expenses")
      .select("id,title,amount,entry_date,status")
      .eq("company_id", companyId)
      .gte("entry_date", fromStr)
      .limit(2000),
    supabase
      .from("payments")
      .select("id,type,amount,entry_date,method,status")
      .eq("company_id", companyId)
      .gte("entry_date", fromStr)
      .limit(2000),
  ]);

  return {
    generated_at: new Date().toISOString(),
    company: companyName,
    range_from: fromStr,
    parties: parties.data ?? [],
    products: products.data ?? [],
    sales: sales.data ?? [],
    purchases: purchases.data ?? [],
    expenses: expenses.data ?? [],
    payments: payments.data ?? [],
  };
}

function backupFile(dateStr: string) {
  const dir = new Directory(Paths.document, "backups");
  return new File(dir, `nikash-backup-${dateStr}.json`);
}

export async function createBackupFile(companyId: string, companyName: string): Promise<File> {
  const payload = await buildBackupPayload(companyId, companyName);
  const dateStr = new Date().toISOString().slice(0, 10);
  const file = backupFile(dateStr);
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(payload, null, 2));
  return file;
}

export async function shareBackup(companyId: string, companyName: string) {
  const file = await createBackupFile(companyId, companyName);
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "ব্যাকআপ ফাইল শেয়ার করুন" });
  }
  return file;
}

function lastBackupKey(companyId: string) {
  return `nikash:last-backup-date:${companyId}`;
}

// Called once per app-open (see app/(tabs)/more.tsx). Runs at most once a
// day per company — silently, best-effort — so a normal day of app usage
// produces the "দৈনিক" backup without the user having to remember to.
export async function runDailyBackupIfNeeded(companyId: string, companyName: string) {
  const today = new Date().toISOString().slice(0, 10);
  const last = await AsyncStorage.getItem(lastBackupKey(companyId));
  if (last === today) return;
  try {
    await createBackupFile(companyId, companyName);
    await AsyncStorage.setItem(lastBackupKey(companyId), today);
  } catch {
    // best-effort — will retry on next app open
  }
}
