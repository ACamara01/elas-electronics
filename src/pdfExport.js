import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportSalesPDF({ shopName, monthLabel, sales, totalSales, totalProfit }) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(shopName, 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(90, 100, 115);
  doc.text(`Sales Report — ${monthLabel}`, 14, 26);

  autoTable(doc, {
    startY: 34,
    head: [["Date", "Item", "Qty", "Price", "Total", "Profit"]],
    body: sales.map((s) => [
      s.date,
      s.itemName,
      String(s.qty),
      s.sellPrice.toFixed(2),
      s.total.toFixed(2),
      s.profit.toFixed(2),
    ]),
    foot: [["", "", "", "Totals", totalSales.toFixed(2), totalProfit.toFixed(2)]],
    headStyles: { fillColor: [41, 84, 230] },
    footStyles: {
      fillColor: [238, 242, 255],
      textColor: [16, 24, 40],
      fontStyle: "bold",
    },
    styles: { fontSize: 9, cellPadding: 5 },
  });

  const safeShop = shopName.replace(/\s+/g, "_");
  doc.save(`${safeShop}_Sales_Report_${monthLabel}.pdf`);
}
