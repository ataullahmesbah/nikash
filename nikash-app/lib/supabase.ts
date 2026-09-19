import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "./secure-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — set them in .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // টোকেন Keystore/Keychain-এ — বিস্তারিত secure-storage.ts-এ
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// README (Nikash DB setup): phone numbers are converted to a synthetic
// email because Supabase phone-auth needs a paid SMS provider.
// 01712345678 -> 01712345678@nikash.app
export function phoneToEmail(phone: string) {
  const digitsOnly = phone.replace(/\D/g, "");
  return `${digitsOnly}@nikash.app`;
}

export async function signInWithPhone(phone: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });
}
