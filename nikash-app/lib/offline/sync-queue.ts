import * as Crypto from "expo-crypto";
import { getDb } from "./db";
import { supabase } from "../supabase";

export type QueuedWrite = {
  id: string;
  table_name: string;
  operation: "insert" | "update";
  payload: string;
  status: "pending" | "synced" | "failed";
  error_message: string | null;
  retry_count: number;
  created_at: string;
};

// Writes go here first — this resolves the moment SQLite commits, which
// is what makes entry feel instant (<200ms, PRD non-functional target)
// regardless of whether the phone has a signal right now.
export async function enqueueWrite(
  table: string,
  operation: "insert" | "update",
  payload: Record<string, unknown>
) {
  const db = getDb();
  const id = Crypto.randomUUID();
  await db.runAsync(
    "insert into sync_queue (id, table_name, operation, payload, status, retry_count, created_at) values (?, ?, ?, ?, 'pending', 0, ?)",
    [id, table, operation, JSON.stringify(payload), new Date().toISOString()]
  );
  // Best-effort immediate push — if we're online this clears in ~1s and
  // the user never notices it went through the queue at all. If we're
  // offline this just fails silently and stays queued.
  processSyncQueue().catch(() => {});
  return id;
}

// enqueueWrite ফায়ার-অ্যান্ড-ফরগেট করে, তাই স্ক্রিন সাথে সাথে back যায় আর
// তালিকা সার্ভার থেকে লোড হয় *সিঙ্ক শেষ হওয়ার আগেই* — ফলে নতুন আইটেম
// "দেরিতে আসছে" মনে হয়। অনলাইনে থাকলে এখানে অল্প সময় অপেক্ষা করলে
// সারি সার্ভারে পৌঁছে যায়, আর অফলাইনে টাইমআউটে ছেড়ে দেয় (UI আটকায় না)।
export async function enqueueWriteAndSync(
  table: string,
  operation: "insert" | "update",
  payload: Record<string, unknown>,
  timeoutMs = 3000
) {
  const id = await enqueueWrite(table, operation, payload);
  await Promise.race([
    processSyncQueue().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  return id;
}

export async function getPendingCount(): Promise<number> {
  const db = getDb();
  const rows = await db.getAllAsync<{ count: number }>(
    "select count(*) as count from sync_queue where status = 'pending'"
  );
  return rows[0]?.count ?? 0;
}

export async function getOldestPendingAge(): Promise<Date | null> {
  const db = getDb();
  const rows = await db.getAllAsync<{ created_at: string }>(
    "select created_at from sync_queue where status = 'pending' order by created_at asc limit 1"
  );
  return rows[0] ? new Date(rows[0].created_at) : null;
}

export async function getLastSyncedAt(): Promise<Date | null> {
  const db = getDb();
  const rows = await db.getAllAsync<{ created_at: string }>(
    "select created_at from sync_queue where status = 'synced' order by created_at desc limit 1"
  );
  return rows[0] ? new Date(rows[0].created_at) : null;
}

let syncing = false;

// PRD 18: uuid-keyed rows so the server can no-op a retried insert instead
// of duplicating it. Every table this touches must have a client-supplied
// primary key (payload.id) for that to work — see README "যেসব ফর্ম এখনো
// সরাসরি Supabase কল করে" for which ones are wired through here so far.
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const db = getDb();
    const pending = await db.getAllAsync<QueuedWrite>(
      "select * from sync_queue where status = 'pending' order by created_at asc"
    );

    for (const item of pending) {
      const payload = JSON.parse(item.payload);
      const query =
        item.operation === "update"
          ? supabase.from(item.table_name).update(payload).eq("id", payload.id)
          : supabase.from(item.table_name).insert(payload);

      const { error } = await query;

      if (error) {
        failed++;
        await db.runAsync(
          "update sync_queue set retry_count = retry_count + 1, error_message = ? where id = ?",
          [error.message, item.id]
        );
      } else {
        synced++;
        await db.runAsync("update sync_queue set status = 'synced' where id = ?", [item.id]);
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}
