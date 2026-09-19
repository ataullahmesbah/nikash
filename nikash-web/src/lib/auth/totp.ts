import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Nikash Admin";

export function generateTotpSecret() {
  return generateSecret();
}

export async function totpQrDataUrl(email: string, secret: string) {
  const otpauthUri = generateURI({ issuer: ISSUER, label: email, secret });
  return QRCode.toDataURL(otpauthUri);
}

export async function verifyTotpCode(secret: string, code: string) {
  try {
    const result = await verify({ secret, token: code.trim() });
    return result.valid;
  } catch {
    return false;
  }
}
