import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "./secure-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * সেটিংস ঠিক আছে কিনা — না থাকলে কোন কোনটা নেই।
 *
 * ⚠️ আগে এখানে সরাসরি `throw` করা হতো। মডিউল লোড হওয়ার সময়েই সেটা চলত,
 * তাই APK-তে মান না পৌঁছালে অ্যাপ এক পলকে বন্ধ হয়ে যেত — পর্দায় কিছুই
 * আসত না, কারণ কী হলো বোঝারও উপায় থাকত না।
 *
 * এখন আর মারা যায় না; app/index.tsx পর্দায় স্পষ্ট করে দেখিয়ে দেয় কী
 * নেই। ডেভেলপমেন্টে .env ভুলে গেলেও একই কথা।
 */
export const supabaseConfigError: string | null = (() => {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("EXPO_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  return missing.length ? missing.join(", ") : null;
})();

// মান না থাকলেও createClient যেন ভেঙে না পড়ে — অ্যাপ চালু হয়ে
// ভদ্রভাবে সমস্যাটা জানাবে, তারপর ব্যবহারকারী কিছু করার আগেই থামবে।
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      // টোকেন Keystore/Keychain-এ — বিস্তারিত secure-storage.ts-এ
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

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
