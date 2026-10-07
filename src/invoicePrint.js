// invoicePrint.js
// 1) Opens a printable A4 invoice in a preview tab (Print / WhatsApp / Close buttons).
// 2) Shares an invoice summary on WhatsApp.
// In the print dialog choose "Save as PDF" if you want a PDF file to send.

// Country code added to LOCAL phone numbers (7 digits or fewer) for WhatsApp.
// 220 = The Gambia. Change it if your customers are in another country.
const DEFAULT_COUNTRY_CODE = "220";

/* =====================================================================
   SMALL HELPERS
   ===================================================================== */

// Stops names that contain < or & from breaking the invoice HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 12 -> "12.00"
function money(n) {
  return Number(n).toFixed(2);
}

// Phone text -> digits only, as WhatsApp links need.
// "345 6789" -> "2203456789"
function whatsappNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, ""); // keep digits only
  if (digits.startsWith("00")) digits = digits.slice(2); // 00220... -> 220...
  if (digits.length > 0 && digits.length <= 7) digits = DEFAULT_COUNTRY_CODE + digits;
  return digits;
}

/* =====================================================================
   WHATSAPP
   ===================================================================== */

// The text message that is sent to the customer
function buildMessage({ shopName, invoice, invoiceNo }) {
  const itemLines = invoice.items.map(
    (it, i) => `${i + 1}. ${it.name} x${it.qty} @ ${money(it.price)} = ${money(it.qty * it.price)}`
  );
  const balance = invoice.total - invoice.paid;
  const method = invoice.paymentMethod ? ` (${invoice.paymentMethod})` : "";

  return [
    `*${shopName}*`, // *text* shows as bold in WhatsApp
    `Invoice ${invoiceNo} - ${invoice.date}`,
    `Customer: ${invoice.customerName}`,
    "",
    ...itemLines,
    "",
    `Total: ${money(invoice.total)}`,
    `Paid: ${money(invoice.paid)}${method}`,
    `Balance: ${money(balance)}`,
    "",
    "Thank you for your business!",
  ].join("\n");
}

// WhatsApp link. With a phone number it opens that customer's chat;
// without one, WhatsApp lets you choose who to send it to.
function whatsappUrl(details) {
  const number = whatsappNumber(details.invoice.customerPhone);
  return `https://wa.me/${number}?text=${encodeURIComponent(buildMessage(details))}`;
}

export function shareInvoiceWhatsApp(details) {
  // Same method as the preview: a link opened in a new tab
  // (browsers are less likely to block this than window.open)
  const link = document.createElement("a");
  link.href = whatsappUrl(details);
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
}

/* =====================================================================
   PRINT PREVIEW
   ===================================================================== */

export function printInvoice(details) {
  const { shopName, invoice, invoiceNo } = details;
  const balance = invoice.total - invoice.paid;
  const isPaid = balance <= 0.001;

  // One table row per item
  const rows = invoice.items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.name)}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${money(it.price)}</td>
        <td class="num">${money(it.qty * it.price)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(invoiceNo)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 13px;
      color: #111;
      max-width: 180mm;
      margin: 0 auto;
      padding: 12px;
      -webkit-print-color-adjust: exact; /* print the colored backgrounds */
      print-color-adjust: exact;
    }

    /* Top: shop name on the left, invoice number and date on the right */
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 3px solid #2954e6;
    }
    .shop { font-size: 24px; font-weight: bold; color: #2954e6; }
    .title { font-size: 26px; font-weight: bold; letter-spacing: 2px; text-align: right; }
    .meta { text-align: right; color: #444; margin-top: 4px; line-height: 1.5; }

    /* Customer block */
    .bill-to { margin-top: 22px; line-height: 1.6; }
    .label { font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    .customer { font-size: 15px; font-weight: bold; }

    /* Items table */
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th {
      background: #eef2ff;
      color: #1d3fb8;
      text-align: left;
      padding: 9px 8px;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    td { padding: 9px 8px; border-bottom: 1px solid #e6e9f0; }
    .num { text-align: right; }

    /* Totals */
    .totals { width: 270px; margin-left: auto; margin-top: 18px; }
    .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals .balance {
      border-top: 2px solid #111;
      margin-top: 6px;
      padding-top: 9px;
      font-size: 16px;
      font-weight: bold;
    }
    .status {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      color: #fff;
      background: ${isPaid ? "#158a4a" : "#c23434"};
    }

    .notes { margin-top: 24px; color: #444; }
    .thanks { margin-top: 40px; text-align: center; color: #444; }

    /* Buttons shown on screen only (hidden when printing) */
    .toolbar { text-align: center; margin: 0 0 20px; }
    .toolbar button, .toolbar a {
      display: inline-block;
      padding: 8px 16px;
      margin: 0 4px;
      font-size: 14px;
      cursor: pointer;
      border: 1px solid #999;
      border-radius: 6px;
      background: #fff;
      color: #111;
      text-decoration: none;
      font-family: inherit;
    }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print</button>
    <a href="${escapeHtml(whatsappUrl(details))}" target="_blank" rel="noopener">WhatsApp</a>
    <button onclick="window.close()">Close</button>
  </div>

  <div class="top">
    <div class="shop">${escapeHtml(shopName)}</div>
    <div>
      <div class="title">INVOICE</div>
      <div class="meta">
        No: <strong>${escapeHtml(invoiceNo)}</strong><br />
        Date: ${escapeHtml(invoice.date)}
      </div>
    </div>
  </div>

  <div class="bill-to">
    <div class="label">Bill to</div>
    <div class="customer">${escapeHtml(invoice.customerName)}</div>
    ${invoice.customerPhone ? `<div>${escapeHtml(invoice.customerPhone)}</div>` : ""}
    ${invoice.customerAddress ? `<div>${escapeHtml(invoice.customerAddress)}</div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Price</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total</span><span>${money(invoice.total)}</span></div>
    <div class="row">
      <span>Paid${invoice.paymentMethod ? ` (${escapeHtml(invoice.paymentMethod)})` : ""}</span>
      <span>${money(invoice.paid)}</span>
    </div>
    <div class="row balance"><span>Balance due</span><span>${money(balance)}</span></div>
    <span class="status">${isPaid ? "PAID IN FULL" : "BALANCE DUE"}</span>
  </div>

  ${invoice.notes ? `<div class="notes"><span class="label">Notes</span><br />${escapeHtml(invoice.notes)}</div>` : ""}

  <div class="thanks">Thank you for your business!</div>
</body>
</html>`;

  // Open the invoice as an in-memory page in its OWN tab ("noopener"),
  // so the app does not freeze while the print dialog is open.
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();

  // Clean up the temporary file after a minute
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}