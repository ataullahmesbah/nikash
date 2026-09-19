import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;

// One shared local database for the whole app. Holds the outbox
// (sync_queue) that makes writes instant regardless of connectivity —
// PRD section 18: entry -> local SQLite -> sync queue -> server.
export function getDb() {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync("nikash.db");
    dbInstance.execSync(`
      create table if not exists sync_queue (
        id text primary key,
        table_name text not null,
        operation text not null,
        payload text not null,
        status text not null default 'pending',
        error_message text,
        retry_count integer not null default 0,
        created_at text not null
      );
    `);
  }
  return dbInstance;
}
