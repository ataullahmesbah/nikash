// Same convention as the mobile app (nikash-app/lib/supabase.ts) and the
// DB setup README: Supabase phone-auth needs a paid SMS provider, so
// phone numbers are converted to a synthetic email instead.
// 01712345678 -> 01712345678@nikash.app
export function phoneToEmail(phone: string) {
  const digitsOnly = phone.replace(/\D/g, "");
  return `${digitsOnly}@nikash.app`;
}

export function isValidBangladeshiPhone(phone: string) {
  return /^01[3-9]\d{8}$/.test(phone.replace(/\D/g, ""));
}
