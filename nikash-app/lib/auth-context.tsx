import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type CompanyProfile = {
  id: string;
  name: string;
  role: string;
  business_type: "vendor" | "warehouse" | "shop";
  company_id: string;
  companies: { name: string; nikash_id: string; status: string } | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: CompanyProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    // RLS ensures this only ever returns the caller's own row.
    const { data } = await supabase
      .from("users")
      .select("id, name, role, company_id, companies(name, nikash_id, status)")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as unknown as CompanyProfile) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function signOut() {
    // PRD 18 rule #1: only the auth token is cleared here — the local
    // sync_queue SQLite database (lib/offline) is never touched by
    // logout. The pending-sync confirmation (rule #2) lives in the
    // screen that calls this (app/(tabs)/more.tsx), since it needs to
    // show the user a dialog before deciding whether to proceed.
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
