import { formatDateBn, todayIso } from "./format";
import { PDF_BASE_CSS, PDF_FONT_HEAD, esc, money, printHtml, shareHtmlAsPdf } from "./pdf-base";

export type LedgerEntry = {
  date: string;
  description: string;
  debit: number; // পার্টির দেনা বাড়ায় (চালান)
  credit: number; // দেনা কমায় (পেমেন্ট/রিটার্ন)
};

export type LedgerData = {
  companyName: string;
  companyPhone?: string | null;
  partyName: string;
  partyPhone?: string | null;
  partyAddress?: string | null;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
  fromDate?: string | null;
  toDate?: string | null;
};

function buildHtml(data: LedgerData): string {
  let running = data.openingBalance;
  const rows = data.entries
    .map((e) => {
      running += e.debit - e.credit;
      return `
      <tr>
        <td class="nowrap">${esc(formatDateBn(e.date, true))}</td>
        <td>${esc(e.description)}</td>
        <td class="right">${e.debit ? money(e.debit) : "—"}</td>
        <td class="right">${e.credit ? money(e.credit) : "—"}</td>
        <td class="right strong">${money(running)}</td>
      </tr>`;
    })
    .join("");

  const totalDebit = data.entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = data.entries.reduce((s, e) => s + e.credit, 0);
  const period =
    data.fromDate && data.toDate
      ? `${formatDateBn(data.fromDate, true)} – ${formatDateBn(data.toDate, true)}`
      : null;

  return `<!DOCTYPE html>
  <html lang="bn">
    <head>
      ${PDF_FONT_HEAD}
      <title>${esc(data.partyName)} — খাতা</title>
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
        .party {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
          padding: 10px 12px;
        }
        .nowrap { white-space: nowrap; }
        .strong { font-weight: 600; }
        tfoot td { font-weight: 700; border-top: 2px solid #0f172a; }
        .closing {
          margin-top: 16px; margin-left: auto; width: 270px;
          border: 2px solid #0f172a; border-radius: 8px; padding: 10px 12px;
          display: flex; justify-content: space-between; font-size: 15px; font-weight: 700;
        }
        .owes { color: #dc2626; }
        .clear { color: #059669; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${esc(data.companyName)}</h1>
          ${data.companyPhone ? `<p class="muted" style="margin:0">মোবাইল: ${esc(data.companyPhone)}</p>` : ""}
          <span class="doc-label">পার্টির খাতা</span>
        </div>
        <div class="right">
          ${period ? `<p class="muted" style="margin:0">${esc(period)}</p>` : ""}
          <p class="muted" style="margin:2px 0 0">তৈরি: ${esc(formatDateBn(todayIso(), true))}</p>
        </div>
      </div>

      <div class="party">
        <strong>${esc(data.partyName)}</strong>
        ${data.partyPhone ? ` <span class="muted">(${esc(data.partyPhone)})</span>` : ""}
        ${data.partyAddress ? `<br/><span class="muted">${esc(data.partyAddress)}</span>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>বিবরণ</th>
            <th class="right">দেনা</th>
            <th class="right">জমা</th>
            <th class="right">ব্যালেন্স</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="nowrap">—</td>
            <td class="muted">পূর্বের জের</td>
            <td class="right">—</td>
            <td class="right">—</td>
            <td class="right strong">${money(data.openingBalance)}</td>
          </tr>
          ${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">সর্বমোট</td>
            <td class="right">${money(totalDebit)}</td>
            <td class="right">${money(totalCredit)}</td>
            <td class="right">${money(data.closingBalance)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="closing">
        <span>${data.closingBalance > 0 ? "বর্তমান বাকি" : "সমন্বয় শেষ"}</span>
        <span class="${data.closingBalance > 0 ? "owes" : "clear"}">${money(data.closingBalance)}</span>
      </div>

      <p class="footer-note">নিকাশ অ্যাপ দিয়ে তৈরি</p>
    </body>
  </html>`;
}

export async function shareLedgerPdf(data: LedgerData): Promise<string> {
  return shareHtmlAsPdf(buildHtml(data), `${data.partyName} — খাতা`);
}

export async function printLedger(data: LedgerData): Promise<void> {
  return printHtml(buildHtml(data));
}
