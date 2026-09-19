import { supabaseAdmin } from "./supabase/admin";

// Every platform-admin action must be recorded (PRD section 21.3).
export async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  const db = supabaseAdmin();
  await db.from("admin_logs").insert({
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    ip_address: params.ipAddress ?? null,
  });
}
