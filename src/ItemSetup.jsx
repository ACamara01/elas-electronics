// ItemSetup.jsx
// The "Item Setup" tab: add, edit and delete products with their buying and selling prices.
// Self-contained, like Invoices.jsx: it reads the shared cached data and saves its own changes.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { insertItem, updateItemRow, deleteItemRow } from "./db.js";
import { useItems } from "./queries.js";

export default function ItemSetup() {
  /* ---------- DATA (shared cache) ---------- */
  const queryClient = useQueryClient();
  const itemsQuery = useItems();

  const items = itemsQuery.data ?? [];

  // "Loading…" shows only on the very first load, when there is no data yet
  const loading = itemsQuery.isLoading;
  // If a refresh fails, the old data stays on screen and this message shows above it
  const error = itemsQuery.error?.message || "";

  // The save / edit / delete code below calls setItems.
  // This helper updates the cached items list.
  function setItems(updater) {
    queryClient.setQueryData(["items"], (old = []) => updater(old));
  }

  /* ---------- FORM STATE ---------- */
  const [itemForm, setItemForm] = useState({
    name: "",
    buyPrice: "",
    sellPrice: "",
  });
  const [editingItemId, setEditingItemId] = useState(null); // null = adding new
  const [itemSaving, setItemSaving] = useState(false);

  /* ---------- HANDLERS ---------- */

  function resetItemForm() {
    setItemForm({ name: "", buyPrice: "", sellPrice: "" });
    setEditingItemId(null);
  }

  // Add a new item or save changes to an existing one
  async function submitItem(e) {
    e.preventDefault();
    const name = itemForm.name.trim();
    const buyPrice = parseFloat(itemForm.buyPrice);
    const sellPrice = parseFloat(itemForm.sellPrice);
    if (!name || isNaN(buyPrice) || isNaN(sellPrice)) return;

    setItemSaving(true);
    try {
      if (editingItemId) {
        const updated = await updateItemRow(editingItemId, {
          name,
          buyPrice,
          sellPrice,
        });
        setItems((prev) => prev.map((it) => (it.id === editingItemId ? updated : it)));
      } else {
        const created = await insertItem({ name, buyPrice, sellPrice });
        // Keep the list sorted A-Z by name
        setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      resetItemForm();
    } catch (err) {
      alert(err.message || "Failed to save item.");
    } finally {
      setItemSaving(false);
    }
  }

  // Put an item's values into the form so it can be edited
  function editItem(item) {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      buyPrice: String(item.buyPrice),
      sellPrice: String(item.sellPrice),
    });
  }

  async function deleteItem(id) {
    if (
      !confirm("Delete this item? Existing sales records will keep their own saved prices.")
    )
      return;
    try {
      await deleteItemRow(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete item.");
    }
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
        <h2>Items</h2>
        <p className="hint">
          Set up each product with its wholesale (buying) price and your usual selling price.
          This is used to auto-fill and calculate profit when you log a sale.
        </p>

        {/* Add / edit item form */}
        <form className="form-row" onSubmit={submitItem}>
          <input
            type="text"
            placeholder="Item name"
            value={itemForm.name}
            onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Buying price"
            value={itemForm.buyPrice}
            onChange={(e) => setItemForm((f) => ({ ...f, buyPrice: e.target.value }))}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Selling price"
            value={itemForm.sellPrice}
            onChange={(e) => setItemForm((f) => ({ ...f, sellPrice: e.target.value }))}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={itemSaving}>
            {itemSaving ? "Saving…" : editingItemId ? "Save changes" : "Add item"}
          </button>
          {editingItemId && (
            <button type="button" className="btn btn-secondary" onClick={resetItemForm}>
              Cancel
            </button>
          )}
        </form>

        {/* Items table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Buying price</th>
                <th>Selling price</th>
                <th>Margin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    No items yet — add your first product above.
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id}>
                  <td data-label="Item">{it.name}</td>
                  <td data-label="Buying price">{it.buyPrice.toFixed(2)}</td>
                  <td data-label="Selling price">{it.sellPrice.toFixed(2)}</td>
                  <td data-label="Margin" className="pos">{(it.sellPrice - it.buyPrice).toFixed(2)}</td>
                  <td className="actions">
                    <button className="link-btn" onClick={() => editItem(it)}>
                      Edit
                    </button>
                    <button className="link-btn danger" onClick={() => deleteItem(it.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
