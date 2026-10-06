// receipt.js
// Builds a small printable receipt for ONE sale and shows it in a new tab.
// The tab has Print / Close buttons. In the print dialog you can pick a printer,
// or choose "Save as PDF" and then share that PDF with the buyer on WhatsApp.

// Stops item names that contain < or & from breaking the receipt HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function printReceipt({ shopName, sale }) {
  // Brand prefix from the shop name: "Elas Electronics" -> "EE"
  const prefix = shopName
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  // Receipt number: brand prefix + end of the sale id, e.g. EE-68DD
  const receiptNo = `${prefix}-${String(sale.id).slice(-4).toUpperCase()}`;

  // NOTE: buy price and profit are NOT shown, because this goes to the buyer
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${receiptNo}</title>
  <style>
    @page { margin: 6mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 13px;
      color: #000;
      width: 72mm;      /* fits an 80mm receipt printer */
      margin: 0 auto;
    }
    h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
    .center { text-align: center; }
    .small { font-size: 11px; color: #444; }
    hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .total { font-size: 16px; font-weight: bold; }

    /* Buttons shown on screen only (hidden when printing) */
    .toolbar { text-align: center; margin: 12px 0 16px; }
    .toolbar button { padding: 8px 16px; margin: 0 4px; font-size: 14px; cursor: pointer; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
 

  <h1>${escapeHtml(shopName)}</h1>
  <p class="center small">Sales Receipt</p>
  <hr />

  <div class="row"><span>Receipt No:</span><span>${receiptNo}</span></div>
  <div class="row"><span>Date:</span><span>${escapeHtml(sale.date)}</span></div>
  <hr />

  <div>${escapeHtml(sale.itemName)}</div>
  <div class="row small">
    <span>${sale.qty} x ${sale.sellPrice.toFixed(2)}</span>
    <span>${sale.total.toFixed(2)}</span>
  </div>
  <hr />

  <div class="row total"><span>TOTAL</span><span>${sale.total.toFixed(2)}</span></div>
  <hr />

  <p class="center">Thank you for your purchase!</p>

   <div class="toolbar">
    <button onclick="window.print()">Print</button>
    <button onclick="window.close()">Close</button>
  </div>
</body>
</html>`;

  // Save the receipt as an in-memory file (Blob) and open it in its OWN tab.
  // "noopener" keeps the receipt tab separate from the app, so the app
  // does not freeze while the print dialog is open.
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



// // receipt.js
// // Builds a small printable receipt for ONE sale and opens the print dialog.
// // In the print dialog you can pick a printer, or choose "Save as PDF"
// // and then share that PDF with the buyer on WhatsApp.

// // Stops item names that contain < or & from breaking the receipt HTML
// function escapeHtml(text) {
//   return String(text)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// }

// export function printReceipt({ shopName, sale }) {
//   // Short receipt number taken from the end of the sale id
//   // const receiptNo = String(sale.id).slice(-6).toUpperCase();
//   // Brand prefix from the shop name: "Elas Electronics" -> "EE"
// const prefix = shopName
// .split(" ")
// .filter(Boolean)
// .map((word) => word[0])
// .join("")
// .toUpperCase();

// // const receiptNo = `${prefix}-${String(sale.id).slice(-6).toUpperCase()}`;
// const receiptNo = `${prefix}-${String(sale.id).slice(-4).toUpperCase()}`;

//   // NOTE: buy price and profit are NOT shown, because this goes to the buyer
//   const html = `<!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8" />
//   <title>Receipt ${receiptNo}</title>
//   <style>
//     @page { margin: 6mm; }
//     body {
//       font-family: Arial, sans-serif;
//       font-size: 13px;
//       color: #000;
//       width: 72mm;      /* fits an 80mm receipt printer; centered on A4 */
//       margin: 0 auto;
//     }
//     h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
//     .center { text-align: center; }
//     .small { font-size: 11px; color: #444; }
//     hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
//     .row { display: flex; justify-content: space-between; margin: 4px 0; }
//     .total { font-size: 16px; font-weight: bold; }
//   </style>
// </head>
// <body>
// <div class="toolbar">
//     <button onclick="window.print()">Print</button>
//     <button onclick="window.close()">Close</button>
//   </div>


//   <h1>${escapeHtml(shopName)}</h1>
//   <p class="center small">Sales Receipt</p>
//   <hr />

//   <div class="row"><span>Receipt No:</span><span>${receiptNo}</span></div>
//   <div class="row"><span>Date:</span><span>${escapeHtml(sale.date)}</span></div>
//   <hr />

//   <div>${escapeHtml(sale.itemName)}</div>
//   <div class="row small">
//     <span>${sale.qty} x ${sale.sellPrice.toFixed(2)}</span>
//     <span>${sale.total.toFixed(2)}</span>
//   </div>
//   <hr />

//   <div class="row total"><span>TOTAL</span><span>${sale.total.toFixed(2)}</span></div>
//   <hr />

//   <p class="center">Thank you for your purchase!</p>
// </body>
// </html>`;

//   // Open a small window, write the receipt into it, then print
//   const win = window.open("", "_blank", "width=400,height=600");
//   if (!win) {
//     alert("Please allow pop-ups for this site to print the receipt.");
//     return;
//   }
//   win.document.write(html);
//   win.document.close();
//   win.focus();
 
// }
