import { formatDateBn } from "./format";
import {
  PDF_BASE_CSS,
  PDF_FONT_HEAD,
  esc,
  money,
  printHtml,
  shareHtmlAsPdf,
} from "./pdf-base";

export type InvoiceLine = {
  productName: string;
  variantName: string;
  unitName: string;
  qty: number;
  unitPrice: number;
  total: number;
};

export type InvoiceData = {
  documentLabel: string; // "বিক্রয় চালান" | "ক্রয় চালান"
  companyName: string;
  companyPhone?: string | null;
  companyAddress?: string | null;
  invoiceNo: string;
  date: string;
  partyLabel: string; // "ক্রেতা" | "সরবরাহকারী"
  partyName: string;
  partyPhone?: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  extraLabel?: string; // যেমন ক্রয়ে "পরিবহন খরচ"
  extraAmount?: number;
  total: number;
  paid: number;
  due: number;
  note?: string | null;
};

function buildHtml(data: InvoiceData): string {
  const rows = data.lines
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          ${esc(l.productName)}
          ${l.variantName ? `<br/><span class="muted">${esc(l.variantName)}</span>` : ""}
        </td>
        <td class="right">${l.qty} ${esc(l.unitName)}</td>
        <td class="right">${money(l.unitPrice)}</td>
        <td class="right">${money(l.total)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
  <html lang="bn">
    <head>
      ${PDF_FONT_HEAD}
      <title>${esc(data.invoiceNo)}</title>
      <style>
        ${PDF_BASE_CSS}
        .header {
          display: flex; justify-content: space-between; gap: 16px;
          border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;
        }
        h1 { font-size: 19px; margin: 0 0 2px; }
        .doc-label {
          display: inline-block; background: #0f172a; color: #fff;
          padding: 3px 10px; border-radius: 999px; font-size: 11px; margin-top: 6px;
        }
        .invoice-no { font-size: 15px; font-weight: 700; }
        .party {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
          padding: 10px 12px; margin-bottom: 4px;
        }
        .num { width: 26px; color: #94a3b8; }
        .summary { margin-top: 16px; width: 270px; margin-left: auto; }
        .summary div { display: flex; justify-content: space-between; padding: 4px 0; }
        .grand {
          font-weight: 700; font-size: 15px;
          border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px;
        }
        .due { color: #dc2626; font-weight: 700; }
        .paid { color: #059669; }
        .note { margin-top: 18px; font-size: 12px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${esc(data.companyName)}</h1>
          ${data.companyAddress ? `<p class="muted" style="margin:0">${esc(data.companyAddress)}</p>` : ""}
          ${data.companyPhone ? `<p class="muted" style="margin:0">মোবাইল: ${esc(data.companyPhone)}</p>` : ""}
          <span class="doc-label">${esc(data.documentLabel)}</span>
        </div>
        <div class="right">
          <p class="invoice-no" style="margin:0">${esc(data.invoiceNo)}</p>
          <p class="muted" style="margin:2px 0 0">${esc(formatDateBn(data.date))}</p>
        </div>
      </div>

      <div class="party">
        <strong>${esc(data.partyLabel)}:</strong> ${esc(data.partyName)}
        ${data.partyPhone ? ` <span class="muted">(${esc(data.partyPhone)})</span>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>প্রোডাক্ট</th>
            <th class="right">পরিমাণ</th>
            <th class="right">দাম</th>
            <th class="right">মোট</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary">
        <div><span>সাবটোটাল</span><span>${money(data.subtotal)}</span></div>
        ${data.discount ? `<div><span>ছাড়</span><span>− ${money(data.discount)}</span></div>` : ""}
        ${
          data.extraLabel
            ? `<div><span>${esc(data.extraLabel)}</span><span>${money(data.extraAmount ?? 0)}</span></div>`
            : ""
        }
        <div class="grand"><span>সর্বমোট</span><span>${money(data.total)}</span></div>
        <div class="paid"><span>জমা</span><span>${money(data.paid)}</span></div>
        <div class="due"><span>বাকি</span><span>${money(data.due)}</span></div>
      </div>

      ${data.note ? `<p class="note">মন্তব্য: ${esc(data.note)}</p>` : ""}

      <p class="footer-note">নিকাশ অ্যাপ দিয়ে তৈরি · ${esc(formatDateBn(data.date))}</p>
    </body>
  </html>`;
}

/** PDF বানিয়ে শেয়ার শিট খোলে (হোয়াটসঅ্যাপ, ড্রাইভ, ইমেইল…) */
export async function shareInvoicePdf(data: InvoiceData): Promise<string> {
  return shareHtmlAsPdf(buildHtml(data), data.invoiceNo);
}

/** সরাসরি প্রিন্টারে পাঠায় */
export async function printInvoice(data: InvoiceData): Promise<void> {
  return printHtml(buildHtml(data));
}
