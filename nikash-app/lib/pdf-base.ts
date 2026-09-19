import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// সব PDF-এর সাধারণ অংশ — বাংলা ফন্ট, HTML escape, ও শেয়ার করার ধাপ।
//
// কেন আলাদা ফাইল: চালান ও লেজার — দুই জায়গাতেই একই ফন্ট ও একই ভুল-বার্তা
// লাগে। আগে ফন্ট লোড হতো না বলে কোনো কোনো ফোনে বাংলা অক্ষর বাক্স হয়ে আসত।

/**
 * WebView-এ বাংলা রেন্ডার করার ফন্ট।
 *
 * Google Fonts থেকে নেওয়ার চেষ্টা করি (নেট থাকলে সবচেয়ে সুন্দর আসে), আর
 * নেট না থাকলে ফোনের নিজস্ব বাংলা ফন্টে পড়ে যায় — Android-এ Noto Sans
 * Bengali বা Kalpurush, iOS-এ Bangla Sangam MN. তাই নেট ছাড়াও PDF বের হয়।
 */
export const PDF_FONT_HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap"
    rel="stylesheet"
  />`;

export const PDF_FONT_STACK =
  `'Noto Sans Bengali', 'Noto Sans Bengali UI', 'Kalpurush', 'SolaimanLipi', ` +
  `'Bangla Sangam MN', 'Nirmala UI', system-ui, sans-serif`;

export const PDF_BASE_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${PDF_FONT_STACK};
    color: #0f172a;
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .muted { color: #64748b; font-size: 12px; }
  .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 12.5px; }
  th { background: #f8fafc; font-weight: 600; }
  tr { page-break-inside: avoid; }
  .footer-note { margin-top: 28px; text-align: center; font-size: 11px; color: #94a3b8; }`;

/**
 * পণ্যের নাম বা পার্টির নামে < > & থাকলে HTML ভেঙে যায় (অথবা ইচ্ছাকৃত
 * ট্যাগ ঢুকে যেতে পারে) — তাই সব ডাইনামিক লেখা এখান দিয়ে পাস করানো হয়।
 */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ৳ সহ দুই দশমিকের অঙ্ক */
export function money(n: number | null | undefined): string {
  return `৳${Number(n ?? 0).toFixed(2)}`;
}

/**
 * HTML → PDF ফাইল → শেয়ার শিট।
 *
 * ভুল হলে চুপ করে না থেকে বাংলা বার্তা ছুড়ে দেয়, যাতে স্ক্রিন টোস্টে
 * দেখাতে পারে — আগে এখানেই সমস্যাটা চাপা পড়ে যেত এবং মনে হতো "PDF হয় না"।
 */
export async function shareHtmlAsPdf(html: string, title: string): Promise<string> {
  let uri: string;
  try {
    const result = await Print.printToFileAsync({ html, base64: false });
    uri = result.uri;
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message
        ? `PDF তৈরি করা যায়নি: ${e.message}`
        : "PDF তৈরি করা যায়নি"
    );
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    // ফাইলটা তৈরি হয়েছে, শুধু শেয়ার শিট নেই — ব্যবহারকারীকে সেটাই বলি
    throw new Error("এই ফোনে শেয়ার করার অপশন নেই, তবে PDF তৈরি হয়েছে");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: title,
    UTI: "com.adobe.pdf",
  });

  return uri;
}

/** সরাসরি প্রিন্ট ডায়ালগ (ব্লুটুথ/ওয়াইফাই প্রিন্টার) */
export async function printHtml(html: string): Promise<void> {
  try {
    await Print.printAsync({ html });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message ? `প্রিন্ট করা যায়নি: ${e.message}` : "প্রিন্ট করা যায়নি"
    );
  }
}
