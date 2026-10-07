// SalesLog.jsx
// The "Sales Log" tab: log sales, see the month's totals, print receipts, download the PDF.
// Self-contained, like Invoices.jsx: it reads the shared cached data and saves its own changes.

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { insertSale, updateSaleRow, deleteSaleRow } from "./db.js";
import { useItems, useSales } from "./queries.js";
import { exportSalesPDF } from "./pdfExport.js";
import { printReceipt } from "./receipt.js";

/* =====================================================================
   HELPER FUNCTIONS (plain functions, no React needed)
   ===================================================================== */

// Today as YYYY-MM-DD
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Current month as YYYY-MM (the format the <input type="month"> uses)
function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

// "2026-09" -> "September 2026"
function monthLabel(monthValue) {
  const [y, m] = monthValue.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Date to pre-fill for a month: today if it's the current month, otherwise the 1st
function defaultDateForMonth(monthValue) {
  if (monthValue === currentMonthValue()) return todayISO();
  return monthValue + "-01";
}

// Last day of a month as YYYY-MM-DD (used to limit the date picker)
function lastDateOfMonth(monthValue) {
  const [y, m] = monthValue.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
  return `${monthValue}-${String(lastDay).padStart(2, "0")}`;
}

/* =====================================================================
   COMPONENT
   ===================================================================== */

export default function SalesLog({ shopName }) {
  /* ---------- DATA (shared cache) ---------- */
  const queryClient = useQueryClient();
  const itemsQuery = useItems();
  const salesQuery = useSales();

  const items = itemsQuery.data ?? [];
  const sales = salesQuery.data ?? [];

  // "Loading…" shows only on the very first load, when there is no data yet
  const loading = itemsQuery.isLoading || salesQuery.isLoading;
  // If a refresh fails, the old data stays on screen and this message shows above it
  const error = (itemsQuery.error || salesQuery.error)?.message || "";

  // The save / edit / delete code below calls setSales.
  // This helper updates the cached sales list.
  function setSales(updater) {
    queryClient.setQueryData(["sales"], (old = []) => updater(old));
  }

  /* ---------- FORM STATE ---------- */
  const [month, setMonth] = useState(currentMonthValue()); // selected month (YYYY-MM)
  const [saleForm, setSaleForm] = useState({
    date: todayISO(),
    itemId: "",
    itemName: "",
    qty: "1",
    sellPrice: "",
  });
  const [editingSaleId, setEditingSaleId] = useState(null); // null = adding new
  const [saleSaving, setSaleSaving] = useState(false);

  /* ---------- DERIVED DATA ---------- */

  // Only the sales in the selected month, oldest first
  const monthSales = useMemo(
    () =>
      sales
        .filter((s) => s.date.slice(0, 7) === month)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [sales, month]
  );

  // Running totals for the selected month
  const totals = useMemo(() => {
    return monthSales.reduce(
      (acc, s) => ({
        totalSales: acc.totalSales + s.total,
        totalProfit: acc.totalProfit + s.profit,
      }),
      { totalSales: 0, totalProfit: 0 }
    );
  }, [monthSales]);

  /* ---------- HANDLERS ---------- */

  // Clear the form; the date goes back to the selected month's default
  function resetSaleForm() {
    setSaleForm({
      date: defaultDateForMonth(month),
      itemId: "",
      itemName: "",
      qty: "1",
      sellPrice: "",
    });
    setEditingSaleId(null);
  }

  // When the month changes, move the date field into that month
  function handleMonthChange(value) {
    if (!value) return; // the month picker was cleared
    setMonth(value);
    if (!editingSaleId) {
      setSaleForm((f) => ({ ...f, date: defaultDateForMonth(value) }));
    }
  }

  // As the user types an item name, auto-fill the price if it matches a saved item
  function onItemNameInput(name) {
    const match = items.find((it) => it.name.toLowerCase() === name.toLowerCase());
    if (match) {
      setSaleForm((f) => ({
        ...f,
        itemId: match.id,
        itemName: match.name,
        sellPrice: String(match.sellPrice),
      }));
    } else {
      setSaleForm((f) => ({ ...f, itemId: "", itemName: name }));
    }
  }

  // Add a new sale or save changes to an existing one
  async function submitSale(e) {
    e.preventDefault();
    const item = items.find((it) => it.id === saleForm.itemId);
    const qty = parseFloat(saleForm.qty);
    const sellPrice = parseFloat(saleForm.sellPrice);
    if (!item || isNaN(qty) || qty <= 0 || isNaN(sellPrice)) return;

    // Total and profit are saved with the sale, so later price changes don't affect old records
    const total = qty * sellPrice;
    const profit = qty * (sellPrice - item.buyPrice);

    const saleData = {
      date: saleForm.date,
      itemId: item.id,
      itemName: item.name,
      qty,
      sellPrice,
      buyPrice: item.buyPrice,
      total,
      profit,
    };

    setSaleSaving(true);
    try {
      if (editingSaleId) {
        const updated = await updateSaleRow(editingSaleId, saleData);
        setSales((prev) => prev.map((s) => (s.id === editingSaleId ? updated : s)));
      } else {
        const created = await insertSale(saleData);
        setSales((prev) => [...prev, created]);
      }
      resetSaleForm();
    } catch (err) {
      alert(err.message || "Failed to save sale.");
    } finally {
      setSaleSaving(false);
    }
  }

  // Put a sale's values into the form so it can be edited
  function editSale(sale) {
    setEditingSaleId(sale.id);
    setSaleForm({
      date: sale.date,
      itemId: sale.itemId,
      itemName: sale.itemName,
      qty: String(sale.qty),
      sellPrice: String(sale.sellPrice),
    });
  }

  async function deleteSale(id) {
    if (!confirm("Delete this sale entry?")) return;
    try {
      await deleteSaleRow(id);
      setSales((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete sale.");
    }
  }

  // Print a receipt for one sale (for the buyer)
  function handlePrint(sale) {
    printReceipt({ shopName, sale });
  }

  function downloadPDF() {
    if (monthSales.length === 0) {
      alert("No sales recorded for this month yet.");
      return;
    }
    exportSalesPDF({
      shopName,
      monthLabel: monthLabel(month),
      sales: monthSales,
      totalSales: totals.totalSales,
      totalProfit: totals.totalProfit,
    });
  }

  /* =====================================================================
     PAGE (all hooks stay ABOVE this line)
     ===================================================================== */

  if (loading) {
    return <p className="hint">Loading your data…</p>;
  }

  return (
    <>
      {error && <p className="warning">{error}</p>}

      <section className="panel">
        {/* Title, month picker and PDF button */}
        <div className="sales-toolbar">
          <div>
            <h2>Sales Log</h2>
            <p className="hint">
              Log each sale below. Totals update automatically for the selected month.
            </p>
          </div>
          <div className="toolbar-actions">
            <label className="month-picker">
              <span>Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" onClick={downloadPDF}>
              Download PDF
            </button>
          </div>
        </div>

        {/* Add / edit sale form */}
        <form className="form-row form-sale" onSubmit={submitSale}>
          {/* Date is limited to the selected month */}
          <input
            type="date"
            value={saleForm.date}
            min={`${month}-01`}
            max={lastDateOfMonth(month)}
            onChange={(e) => setSaleForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
          <input
            type="text"
            list="items-datalist"
            placeholder="Type item name…"
            value={saleForm.itemName}
            onChange={(e) => onItemNameInput(e.target.value)}
            required
          />
          {/* Suggestions shown while typing the item name */}
          <datalist id="items-datalist">
            {items.map((it) => (
              <option key={it.id} value={it.name} />
            ))}
          </datalist>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Qty"
            value={saleForm.qty}
            onChange={(e) => setSaleForm((f) => ({ ...f, qty: e.target.value }))}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={saleForm.sellPrice}
            onChange={(e) => setSaleForm((f) => ({ ...f, sellPrice: e.target.value }))}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={saleSaving}>
            {saleSaving ? "Saving…" : editingSaleId ? "Save changes" : "Add sale"}
          </button>
          {editingSaleId && (
            <button type="button" className="btn btn-secondary" onClick={resetSaleForm}>
              Cancel
            </button>
          )}
        </form>

        {/* Reminder shown when no items exist yet */}
        {items.length === 0 && (
          <p className="warning">
            Add at least one item under "Item Setup" before logging a sale.
          </p>
        )}

        {/* Sales table for the selected month */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
                <th>Profit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {monthSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No sales logged for {monthLabel(month)} yet.
                  </td>
                </tr>
              )}
              {monthSales.map((s) => (
                <tr key={s.id}>
                  <td data-label="Date">{s.date}</td>
                  <td data-label="Item">{s.itemName}</td>
                  <td data-label="Qty">{s.qty}</td>
                  <td data-label="Price">{s.sellPrice.toFixed(2)}</td>
                  <td data-label="Total">{s.total.toFixed(2)}</td>
                  <td data-label="Profit" className={s.profit >= 0 ? "pos" : "neg"}>{s.profit.toFixed(2)}</td>
                  <td className="actions">
                    <button className="link-btn preview" onClick={() => handlePrint(s)}>
                      Print
                    </button>
                    <button className="link-btn" onClick={() => editSale(s)}>
                      Edit
                    </button>
                    <button className="link-btn danger" onClick={() => deleteSale(s.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Totals row, only shown when there are sales */}
            {monthSales.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Totals — {monthLabel(month)}</td>
                  <td data-label="Total sales">{totals.totalSales.toFixed(2)}</td>
                  <td data-label="Total profit" className={totals.totalProfit >= 0 ? "pos" : "neg"}>
                    {totals.totalProfit.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </>
  );
}
