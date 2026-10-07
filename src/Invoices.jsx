// Invoices.jsx
// The "Invoices" tab: prepare an invoice for a customer and keep a saved copy.
// It loads and saves its own data, so App.jsx barely changes.

import { useState, useEffect } from "react";
import {
  fetchInvoices,
  insertInvoice,
  updateInvoiceRow,
  deleteInvoiceRow,
} from "./invoicesDB.js";
import { printInvoice, shareInvoiceWhatsApp } from "./invoicePrint.js";


/* =====================================================================
   SETTINGS + HELPERS
   ===================================================================== */

// Edit this list to change the payment methods in the dropdown
const PAYMENT_METHODS = ["Cash", "Mobile money", "Bank transfer", "Card"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// One empty item row (qty and price are kept as text while typing)
function emptyLine() {
  return { name: "", qty: "1", price: "" };
}

// A blank invoice form
function emptyForm() {
  return {
    date: todayISO(),
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    lines: [emptyLine()],
    paid: "",
    paymentMethod: PAYMENT_METHODS[0],
    notes: "",
  };
}

// Text -> number (empty or invalid text counts as 0)
function num(value) {
  return parseFloat(value) || 0;
}

// Invoice number like EE-0007: prefix from the shop name + running number
function formatInvoiceNo(shopName, n) {
  const prefix = shopName
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/* =====================================================================
   COMPONENT
   ===================================================================== */

export default function Invoices({ shopName, items }) {
  // Saved invoices
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The form
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null); // null = creating a new invoice
  const [saving, setSaving] = useState(false);

  // Load saved invoices when the tab opens
  useEffect(() => {
    let cancelled = false;
    fetchInvoices()
      .then((data) => {
        if (!cancelled) setInvoices(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load invoices.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- FORM HELPERS ---------- */

  // Change one simple field (customer name, phone, paid, ...)
  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Change values inside one item row
  function setLine(index, changes) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, ...changes } : l)),
    }));
  }

  // Typing an item name: if it matches a saved item, fill in its selling price
  function onLineNameInput(index, name) {
    const match = items.find((it) => it.name.toLowerCase() === name.toLowerCase());
    if (match) {
      setLine(index, { name: match.name, price: String(match.sellPrice) });
    } else {
      setLine(index, { name });
    }
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  }

  // Remove an item row (always keep at least one)
  function removeLine(index) {
    setForm((f) => ({
      ...f,
      lines: f.lines.length === 1 ? f.lines : f.lines.filter((_, i) => i !== index),
    }));
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  /* ---------- LIVE TOTALS ---------- */
  // Balance is never stored: it is always total minus paid
  const total = form.lines.reduce((sum, l) => sum + num(l.qty) * num(l.price), 0);
  const paid = num(form.paid);
  const balance = total - paid;

  /* ---------- SAVE / EDIT / DELETE ---------- */

  async function submitInvoice(e) {
    e.preventDefault();

    // Keep only complete item rows, with real numbers
    const lines = form.lines
      .map((l) => ({
        name: l.name.trim(),
        qty: parseFloat(l.qty),
        price: parseFloat(l.price),
      }))
      .filter((l) => l.name && !isNaN(l.qty) && l.qty > 0 && !isNaN(l.price));

    if (!form.customerName.trim() || lines.length === 0) {
      alert("Please add the customer name and at least one item.");
      return;
    }
    if (paid > total + 0.001) {
      alert("The amount paid is more than the invoice total.");
      return;
    }

    const invoiceData = {
      date: form.date,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      customerAddress: form.customerAddress.trim(),
      items: lines,
      total,
      paid,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
    };

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateInvoiceRow(editingId, invoiceData);
        setInvoices((prev) => prev.map((inv) => (inv.id === editingId ? updated : inv)));
      } else {
        const created = await insertInvoice(invoiceData);
        setInvoices((prev) => [created, ...prev]); // newest first
      }
      resetForm();
    } catch (err) {
      alert(err.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  // Put a saved invoice back into the form so it can be changed
  // (for example to record a later payment)
  function editInvoice(inv) {
    setEditingId(inv.id);
    setForm({
      date: inv.date,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      customerAddress: inv.customerAddress,
      lines: inv.items.map((l) => ({
        name: l.name,
        qty: String(l.qty),
        price: String(l.price),
      })),
      paid: String(inv.paid),
      paymentMethod: inv.paymentMethod || PAYMENT_METHODS[0],
      notes: inv.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // The details the print and share functions need for one invoice
function details(inv) {
  return {
    shopName,
    invoice: inv,
    invoiceNo: formatInvoiceNo(shopName, inv.invoiceNo),
  };
}

// Open the invoice preview. If something fails, show an alert instead of doing nothing
function previewInvoice(inv) {
  try {
    printInvoice(details(inv));
  } catch (err) {
    alert("Could not open the preview: " + err.message);
  }
}

// Open WhatsApp with the invoice message
function shareInvoice(inv) {
  try {
    shareInvoiceWhatsApp(details(inv));
  } catch (err) {
    alert("Could not open WhatsApp: " + err.message);
  }
}

  async function deleteInvoice(id) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    try {
      await deleteInvoiceRow(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      alert(err.message || "Failed to delete invoice.");
    }
  }

  /* =====================================================================
     PAGE
     ===================================================================== */

  return (
    <section className="panel">
      <h2>{editingId ? "Edit Invoice" : "New Invoice"}</h2>
      <p className="hint">
        Prepare an invoice for a customer. The total and balance update as you type.
      </p>

      {error && <p className="warning">{error}</p>}

      <form onSubmit={submitInvoice}>
        {/* ----- Customer details ----- */}
        <div className="form-row">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setField("date", e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Customer name"
            value={form.customerName}
            onChange={(e) => setField("customerName", e.target.value)}
            required
          />
          <input
            type="text"
            inputMode="tel"
            placeholder="Phone"
            value={form.customerPhone}
            onChange={(e) => setField("customerPhone", e.target.value)}
          />
          <input
            type="text"
            placeholder="Address"
            value={form.customerAddress}
            onChange={(e) => setField("customerAddress", e.target.value)}
          />
        </div>

        {/* ----- Item rows ----- */}
        {/* Suggestions shown while typing an item name */}
        <datalist id="invoice-items-datalist">
          {items.map((it) => (
            <option key={it.id} value={it.name} />
          ))}
        </datalist>

        {form.lines.map((line, i) => (
          <div className="form-row invoice-line" key={i}>
            <input
              type="text"
              list="invoice-items-datalist"
              placeholder="Item name…"
              value={line.name}
              onChange={(e) => onLineNameInput(i, e.target.value)}
            />
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Qty"
              value={line.qty}
              onChange={(e) => setLine(i, { qty: e.target.value })}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Price"
              value={line.price}
              onChange={(e) => setLine(i, { price: e.target.value })}
            />
            {/* Line total = qty x price */}
            <span className="line-total">{(num(line.qty) * num(line.price)).toFixed(2)}</span>
            <button type="button" className="link-btn danger" onClick={() => removeLine(i)}>
              Remove
            </button>
          </div>
        ))}

        <button type="button" className="btn btn-secondary" onClick={addLine}>
          + Add item
        </button>

        {/* ----- Payment ----- */}
        <div className="form-row invoice-payment">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount paid"
            value={form.paid}
            onChange={(e) => setField("paid", e.target.value)}
          />
          <select
            value={form.paymentMethod}
            onChange={(e) => setField("paymentMethod", e.target.value)}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>

        {/* ----- Live summary ----- */}
        <div className="invoice-summary">
          <div>
            <span>Total</span>
            <strong className="line-total">{total.toFixed(2)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>{paid.toFixed(2)}</strong>
          </div>
          <div>
            <span>Balance</span>
            <strong className={balance > 0 ? "neg" : "pos"}>{balance.toFixed(2)}</strong>
          </div>
        </div>

        <div className="form-row">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save invoice"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ----- Saved invoices ----- */}
      <h2 className="invoice-list-title">Saved invoices</h2>

      {loading ? (
        <p className="hint">Loading invoices…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No invoices yet. Save your first one above.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => {
                const bal = inv.total - inv.paid;
                return (
                  <tr key={inv.id}>
                    <td>{formatInvoiceNo(shopName, inv.invoiceNo)}</td>
                    <td>{inv.date}</td>
                    <td>{inv.customerName}</td>
                    <td>{inv.total.toFixed(2)}</td>
                    <td>{inv.paid.toFixed(2)}</td>
                    <td className={bal > 0 ? "neg" : "pos"}>{bal.toFixed(2)}</td>
                    <td className="actions">
                      <button className="link-btn preview" onClick={() => previewInvoice(inv)}>
                        Preview
                      </button>
                      <button className="link-btn" onClick={() => editInvoice(inv)}>
                        Edit
                      </button>
                      <button className="link-btn danger" onClick={() => deleteInvoice(inv.id)}>
                        Delete
                      </button>
                      <button className="link-btn whatsapp" onClick={() => shareInvoice(inv)}>
                        WhatsApp
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
