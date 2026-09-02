import { useState, useEffect, useMemo } from "react";
import {fetchItems, insertItem, updateItemRow, deleteItemRow, fetchSales, insertSale, updateSaleRow, deleteSaleRow, } from "./db.js";
import { exportSalesPDF } from "./pdfExport.js";
import { getCurrentSession, onAuthChange, signOut } from "./auth.js";
import Login from "./Login.jsx";

const SHOP_NAME = "Elas Electronics";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function monthLabel(monthValue) {
  const [y, m] = monthValue.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [tab, setTab] = useState("sales"); // "sales" | "items"

  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Check for an existing session on load, then listen for changes.
  useEffect(() => {
    getCurrentSession().then(setSession);
    const unsubscribe = onAuthChange(setSession);
    return unsubscribe;
  }, []);

  // Once logged in, load items + sales from Supabase.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setDataLoading(true);
    setDataError("");
    Promise.all([fetchItems(), fetchSales()])
      .then(([itemsData, salesData]) => {
        if (cancelled) return;
        setItems(itemsData);
        setSales(salesData);
      })
      .catch((err) => {
        if (cancelled) return;
        setDataError(err.message || "Failed to load data.");
      })
      .finally(() => {
        if (cancelled) return;
        setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleLogout() {
    await signOut();
    setTab("sales");
  }

  // ---------- ITEMS ----------
  const [itemForm, setItemForm] = useState({ name: "", buyPrice: "", sellPrice: "" });
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);

  function resetItemForm() {
    setItemForm({ name: "", buyPrice: "", sellPrice: "" });
    setEditingItemId(null);
  }

  async function submitItem(e) {
    e.preventDefault();
    const name = itemForm.name.trim();
    const buyPrice = parseFloat(itemForm.buyPrice);
    const sellPrice = parseFloat(itemForm.sellPrice);
    if (!name || isNaN(buyPrice) || isNaN(sellPrice)) return;

    setItemSaving(true);
    try {
      if (editingItemId) {
        const updated = await updateItemRow(editingItemId, { name, buyPrice, sellPrice });
        setItems((prev) => prev.map((it) => (it.id === editingItemId ? updated : it)));
      } else {
        const created = await insertItem({ name, buyPrice, sellPrice });
        setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      resetItemForm();
    } catch (err) {
      alert(err.message || "Failed to save item.");
    } finally {
      setItemSaving(false);
    }
  }

  function editItem(item) {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      buyPrice: String(item.buyPrice),
      sellPrice: String(item.sellPrice),
    });
  }

  async function deleteItem(id) {
    if (!confirm("Delete this item? Existing sales records will keep their own saved prices.")) return;
    try {
      await deleteItemRow(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete item.");
    }
  }

  // ---------- SALES ----------
  const [month, setMonth] = useState(currentMonthValue());
  const [saleForm, setSaleForm] = useState({
    date: todayISO(),
    itemId: "",
    itemName: "",
    qty: "1",
    sellPrice: "",
  });
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleSaving, setSaleSaving] = useState(false);

  function resetSaleForm() {
    setSaleForm({ date: todayISO(), itemId: "", itemName: "", qty: "1", sellPrice: "" });
    setEditingSaleId(null);
  }

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

  async function submitSale(e) {
    e.preventDefault();
    const item = items.find((it) => it.id === saleForm.itemId);
    const qty = parseFloat(saleForm.qty);
    const sellPrice = parseFloat(saleForm.sellPrice);
    if (!item || isNaN(qty) || qty <= 0 || isNaN(sellPrice)) return;

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

  const monthSales = useMemo(
    () => sales.filter((s) => s.date.slice(0, 7) === month).sort((a, b) => a.date.localeCompare(b.date)),
    [sales, month]
  );

  const totals = useMemo(() => {
    return monthSales.reduce(
      (acc, s) => ({
        totalSales: acc.totalSales + s.total,
        totalProfit: acc.totalProfit + s.profit,
      }),
      { totalSales: 0, totalProfit: 0 }
    );
  }, [monthSales]);

  function downloadPDF() {
    if (monthSales.length === 0) {
      alert("No sales recorded for this month yet.");
      return;
    }
    exportSalesPDF({
      shopName: SHOP_NAME,
      monthLabel: monthLabel(month),
      sales: monthSales,
      totalSales: totals.totalSales,
      totalProfit: totals.totalProfit,
    });
  }

  // Still checking for an existing session — avoid flashing the login screen.
  if (session === undefined) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  return (
    <div className="site">
      <header className="app-header">
        <div className="wrap header-inner">
          <div>
            <h1>{SHOP_NAME}</h1>
            <p>Sales &amp; profit tracker</p>
          </div>
          <div className="header-user">
            <span>{session.user?.email}</span>
            <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <div className="wrap tabs-inner">
          <button
            className={`tab-btn${tab === "sales" ? " active" : ""}`}
            onClick={() => setTab("sales")}
          >
            Sales Log
          </button>
          <button
            className={`tab-btn${tab === "items" ? " active" : ""}`}
            onClick={() => setTab("items")}
          >
            Item Setup
          </button>
        </div>
      </nav>

      <main className="wrap main-content">
        {dataError && <p className="warning">{dataError}</p>}
        {dataLoading && <p className="hint">Loading your data…</p>}

        {!dataLoading && tab === "items" && (
          <section className="panel">
            <h2>Items</h2>
            <p className="hint">
              Set up each product with its wholesale (buying) price and your usual selling price.
              This is used to auto-fill and calculate profit when you log a sale.
            </p>

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
                      <td>{it.name}</td>
                      <td>{it.buyPrice.toFixed(2)}</td>
                      <td>{it.sellPrice.toFixed(2)}</td>
                      <td className="pos">{(it.sellPrice - it.buyPrice).toFixed(2)}</td>
                      <td className="actions">
                        <button className="link-btn" onClick={() => editItem(it)}>Edit</button>
                        <button className="link-btn danger" onClick={() => deleteItem(it.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!dataLoading && tab === "sales" && (
          <section className="panel">
            <div className="sales-toolbar">
              <div>
                <h2>Sales Log</h2>
                <p className="hint">Log each sale below. Totals update automatically for the selected month.</p>
              </div>
              <div className="toolbar-actions">
                <label className="month-picker">
                  <span>Month</span>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
                <button className="btn btn-primary" onClick={downloadPDF}>
                  Download PDF
                </button>
              </div>
            </div>

            <form className="form-row form-sale" onSubmit={submitSale}>
              <input
                type="date"
                value={saleForm.date}
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

            {items.length === 0 && (
              <p className="warning">
                Add at least one item under "Item Setup" before logging a sale.
              </p>
            )}

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
                      <td>{s.date}</td>
                      <td>{s.itemName}</td>
                      <td>{s.qty}</td>
                      <td>{s.sellPrice.toFixed(2)}</td>
                      <td>{s.total.toFixed(2)}</td>
                      <td className={s.profit >= 0 ? "pos" : "neg"}>{s.profit.toFixed(2)}</td>
                      <td className="actions">
                        <button className="link-btn" onClick={() => editSale(s)}>Edit</button>
                        <button className="link-btn danger" onClick={() => deleteSale(s.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {monthSales.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Totals — {monthLabel(month)}</td>
                      <td>{totals.totalSales.toFixed(2)}</td>
                      <td className={totals.totalProfit >= 0 ? "pos" : "neg"}>
                        {totals.totalProfit.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <div className="wrap">
          <span>© {new Date().getFullYear()} {SHOP_NAME}</span>
          <span>Data stored securely in Supabase</span>
        </div>
      </footer>
    </div>
  );
}


// import { useState, useEffect, useMemo } from "react";
// import {
//   loadItems,
//   saveItems,
//   loadSales,
//   saveSales,
//   makeId,
// } from "./storage.js";
// import { exportSalesPDF } from "./pdfExport.js";
// import { getSession, clearSession } from "./auth.js";
// import Login from "./Login.jsx";



// const SHOP_NAME = "Elas Electronics";

// function todayISO() {
//   return new Date().toISOString().slice(0, 10);
// }

// function currentMonthValue() {
//   return new Date().toISOString().slice(0, 7); // YYYY-MM
// }

// function monthLabel(monthValue) {
//   const [y, m] = monthValue.split("-").map(Number);
//   return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
//     month: "long",
//     year: "numeric",
//   });
// }

// export default function App() {
//   const [session, setSession] = useState(() => getSession());
//   const [tab, setTab] = useState("sales"); // "sales" | "items"

//   const [items, setItems] = useState(() => loadItems());
//   const [sales, setSales] = useState(() => loadSales());

//   function handleLogout() {
//     clearSession();
//     setSession(null);
//     setTab("sales");
//   }

//   useEffect(() => saveItems(items), [items]);
//   useEffect(() => saveSales(sales), [sales]);

//   //  ITEMS
//   const [itemForm, setItemForm] = useState({
//     name: "",
//     buyPrice: "",
//     sellPrice: "",
//   });
//   const [editingItemId, setEditingItemId] = useState(null);

//   function resetItemForm() {
//     setItemForm({ name: "", buyPrice: "", sellPrice: "" });
//     setEditingItemId(null);
//   }

//   function submitItem(e) {
//     e.preventDefault();
//     const name = itemForm.name.trim();
//     const buyPrice = parseFloat(itemForm.buyPrice);
//     const sellPrice = parseFloat(itemForm.sellPrice);
//     if (!name || isNaN(buyPrice) || isNaN(sellPrice)) return;

//     if (editingItemId) {
//       setItems((prev) =>
//         prev.map((it) =>
//           it.id === editingItemId ? { ...it, name, buyPrice, sellPrice } : it
//         )
//       );
//     } else {
//       setItems((prev) => [
//         ...prev,
//         { id: makeId(), name, buyPrice, sellPrice },
//       ]);
//     }
//     resetItemForm();
//   }

//   function editItem(item) {
//     setEditingItemId(item.id);
//     setItemForm({
//       name: item.name,
//       buyPrice: String(item.buyPrice),
//       sellPrice: String(item.sellPrice),
//     });
//   }

//   function deleteItem(id) {
//     if (
//       !confirm(
//         "Delete this item? Existing sales records will keep their own saved prices."
//       )
//     )
//       return;
//     setItems((prev) => prev.filter((it) => it.id !== id));
//   }

//   // SALES
//   const [month, setMonth] = useState(currentMonthValue());
//   const [saleForm, setSaleForm] = useState({
//     date: todayISO(),
//     itemId: "",
//     itemName: "",
//     qty: "",
//     sellPrice: "",
//   });
//   const [editingSaleId, setEditingSaleId] = useState(null);

//   function resetSaleForm() {
//     setSaleForm({
//       date: todayISO(),
//       itemId: "",
//       itemName: "",
//       qty: "1",
//       sellPrice: "",
//     });
//     setEditingSaleId(null);
//   }

//   function onItemNameInput(name) {
//     const match = items.find(
//       (it) => it.name.toLowerCase() === name.toLowerCase()
//     );
//     if (match) {
//       setSaleForm((f) => ({
//         ...f,
//         itemId: match.id,
//         itemName: match.name,
//         sellPrice: String(match.sellPrice),
//       }));
//     } else {
//       setSaleForm((f) => ({ ...f, itemId: "", itemName: name }));
//     }
//   }

//   // function onItemPick(itemId) {
//   //   const item = items.find((it) => it.id === itemId);
//   //   setSaleForm((f) => ({
//   //     ...f,
//   //     itemId,
//   //     sellPrice: item ? String(item.sellPrice) : f.sellPrice,
//   //   }));
//   // }

//   function submitSale(e) {
//     e.preventDefault();
//     const item = items.find((it) => it.id === saleForm.itemId);
//     const qty = parseFloat(saleForm.qty);
//     const sellPrice = parseFloat(saleForm.sellPrice);
//     if (!item || isNaN(qty) || qty <= 0 || isNaN(sellPrice)) return;

//     const total = qty * sellPrice;
//     const profit = qty * (sellPrice - item.buyPrice);

//     if (editingSaleId) {
//       setSales((prev) =>
//         prev.map((s) =>
//           s.id === editingSaleId
//             ? {
//                 ...s,
//                 date: saleForm.date,
//                 itemId: item.id,
//                 itemName: item.name,
//                 qty,
//                 sellPrice,
//                 buyPrice: item.buyPrice,
//                 total,
//                 profit,
//               }
//             : s
//         )
//       );
//     } else {
//       setSales((prev) => [
//         ...prev,
//         {
//           id: makeId(),
//           date: saleForm.date,
//           itemId: item.id,
//           itemName: item.name,
//           qty,
//           sellPrice,
//           buyPrice: item.buyPrice,
//           total,
//           profit,
//         },
//       ]);
//     }
//     resetSaleForm();
//   }

//   function editSale(sale) {
//     setEditingSaleId(sale.id);
//     setSaleForm({
//       date: sale.date,
//       itemId: sale.itemId,
//       itemName: sale.itemName,
//       qty: String(sale.qty),
//       sellPrice: String(sale.sellPrice),
//     });
//   }

//   function deleteSale(id) {
//     if (!confirm("Delete this sale entry?")) return;
//     setSales((prev) => prev.filter((s) => s.id !== id));
//   }

//   const monthSales = useMemo(
//     () =>
//       sales
//         .filter((s) => s.date.slice(0, 7) === month)
//         .sort((a, b) => a.date.localeCompare(b.date)),
//     [sales, month]
//   );

//   const totals = useMemo(() => {
//     return monthSales.reduce(
//       (acc, s) => ({
//         totalSales: acc.totalSales + s.total,
//         totalProfit: acc.totalProfit + s.profit,
//       }),
//       { totalSales: 0, totalProfit: 0 }
//     );
//   }, [monthSales]);

//   function downloadPDF() {
//     if (monthSales.length === 0) {
//       alert("No sales recorded for this month yet.");
//       return;
//     }
//     exportSalesPDF({
//       shopName: SHOP_NAME,
//       monthLabel: monthLabel(month),
//       sales: monthSales,
//       totalSales: totals.totalSales,
//       totalProfit: totals.totalProfit,
//     });
//   }

//   if (!session) {
//     return <Login onLogin={setSession} />;
//   }

//   return (
//     <div className="site">
//       <header className="app-header">
//         <div className="wrap header-inner">
//           <div>
//             <h1>{SHOP_NAME}</h1>
//             <p>Sales &amp; profit tracker</p>
//           </div>
//           <div className="header-user">
//             <span>
//               {/* {session.username}{" "} */}
//               <span className="role-badge">{session.role}</span>
//             </span>
//             <button
//               className="btn btn-secondary logout-btn"
//               onClick={handleLogout}
//             >
//               Log out
//             </button>
//           </div>
//         </div>
//       </header>

//       <nav className="tabs">
//         <div className="wrap tabs-inner">
//           <button
//             className={`tab-btn${tab === "sales" ? " active" : ""}`}
//             onClick={() => setTab("sales")}
//           >
//             Sales Log
//           </button>
//           <button
//             className={`tab-btn${tab === "items" ? " active" : ""}`}
//             onClick={() => setTab("items")}
//           >
//             Item Setup
//           </button>
//         </div>
//       </nav>

//       <main className="wrap main-content">
//         {tab === "items" && (
//           <section className="panel">
//             <h2>Items</h2>
//             <p className="hint">
//               Set up each product with its wholesale (buying) price and your
//               usual selling price. This is used to auto-fill and calculate
//               profit when you log a sale.
//             </p>

//             <form className="form-row" onSubmit={submitItem}>
//               <input
//                 type="text"
//                 placeholder="Item name"
//                 value={itemForm.name}
//                 onChange={(e) =>
//                   setItemForm((f) => ({ ...f, name: e.target.value }))
//                 }
//                 required
//               />
//               <input
//                 type="number"
//                 step="0.01"
//                 min="0"
//                 placeholder="Buying price"
//                 value={itemForm.buyPrice}
//                 onChange={(e) =>
//                   setItemForm((f) => ({ ...f, buyPrice: e.target.value }))
//                 }
//                 required
//               />
//               <input
//                 type="number"
//                 step="0.01"
//                 min="0"
//                 placeholder="Selling price"
//                 value={itemForm.sellPrice}
//                 onChange={(e) =>
//                   setItemForm((f) => ({ ...f, sellPrice: e.target.value }))
//                 }
//                 required
//               />
//               <button type="submit" className="btn btn-primary">
//                 {editingItemId ? "Save changes" : "Add item"}
//               </button>
//               {editingItemId && (
//                 <button
//                   type="button"
//                   className="btn btn-secondary"
//                   onClick={resetItemForm}
//                 >
//                   Cancel
//                 </button>
//               )}
//             </form>

//             <div className="table-wrap">
//               <table>
//                 <thead>
//                   <tr>
//                     <th>Item</th>
//                     <th>Buying price</th>
//                     <th>Selling price</th>
//                     <th>Margin</th>
//                     <th></th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {items.length === 0 && (
//                     <tr>
//                       <td colSpan={5} className="empty">
//                         No items yet — add your first product above.
//                       </td>
//                     </tr>
//                   )}
//                   {items.map((it) => (
//                     <tr key={it.id}>
//                       <td>{it.name}</td>
//                       <td>{it.buyPrice.toFixed(2)}</td>
//                       <td>{it.sellPrice.toFixed(2)}</td>
//                       <td className="pos">
//                         {(it.sellPrice - it.buyPrice).toFixed(2)}
//                       </td>
//                       <td className="actions">
//                         <button
//                           className="link-btn"
//                           onClick={() => editItem(it)}
//                         >
//                           Edit
//                         </button>
//                         <button
//                           className="link-btn danger"
//                           onClick={() => deleteItem(it.id)}
//                         >
//                           Delete
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </section>
//         )}

//         {tab === "sales" && (
//           <section className="panel">
//             <div className="sales-toolbar">
//               <div>
//                 <h2>Sales Log</h2>
//                 <p className="hint">
//                   Log each sale below. Totals update automatically for the
//                   selected month.
//                 </p>
//               </div>
//               <div className="toolbar-actions">
//                 <label className="month-picker">
//                   <span>Month</span>
//                   <input
//                     type="month"
//                     value={month}
//                     onChange={(e) => setMonth(e.target.value)}
//                   />
//                 </label>
//                 <button className="btn btn-primary" onClick={downloadPDF}>
//                   Download PDF
//                 </button>
//               </div>
//             </div>

//             <form className="form-row form-sale" onSubmit={submitSale}>
//               <input
//                 type="date"
//                 value={saleForm.date}
//                 onChange={(e) =>
//                   setSaleForm((f) => ({ ...f, date: e.target.value }))
//                 }
//                 required
//               />
//               <input
//                 type="text"
//                 list="items-datalist"
//                 placeholder="Type item name…"
//                 value={saleForm.itemName}
//                 onChange={(e) => onItemNameInput(e.target.value)}
//                 required
//               />
//               <datalist id="items-datalist">
//                 {items.map((it) => (
//                   <option key={it.id} value={it.name} />
//                 ))}
//               </datalist>
//               {/* <select
//                 value={saleForm.itemId}
//                 onChange={(e) => onItemPick(e.target.value)}
//                 required
//               >
//                 <option value="" disabled>
//                   Select item…
//                 </option>
//                 {items.map((it) => (
//                   <option key={it.id} value={it.id}>
//                     {it.name}
//                   </option>
//                 ))}
//               </select> */}
//               <input
//                 type="number"
//                 min="1"
//                 step="1"
//                 placeholder="Qty"
//                 value={saleForm.qty}
//                 onChange={(e) =>
//                   setSaleForm((f) => ({ ...f, qty: e.target.value }))
//                 }
//                 required
//               />
//               <input
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 placeholder="Price"
//                 value={saleForm.sellPrice}
//                 onChange={(e) =>
//                   setSaleForm((f) => ({ ...f, sellPrice: e.target.value }))
//                 }
//                 required
//               />
//               <button type="submit" className="btn btn-primary">
//                 {editingSaleId ? "Save changes" : "Add sale"}
//               </button>
//               {editingSaleId && (
//                 <button
//                   type="button"
//                   className="btn btn-secondary"
//                   onClick={resetSaleForm}
//                 >
//                   Cancel
//                 </button>
//               )}
//             </form>

//             {items.length === 0 && (
//               <p className="warning">
//                 Add at least one item under "Item Setup" before logging a sale.
//               </p>
//             )}

//             <div className="table-wrap">
//               <table>
//                 <thead>
//                   <tr>
//                     <th>Date</th>
//                     <th>Item</th>
//                     <th>Qty</th>
//                     <th>Price</th>
//                     <th>Total</th>
//                     <th>Profit</th>
//                     <th></th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {monthSales.length === 0 && (
//                     <tr>
//                       <td colSpan={7} className="empty">
//                         No sales logged for {monthLabel(month)} yet.
//                       </td>
//                     </tr>
//                   )}
//                   {monthSales.map((s) => (
//                     <tr key={s.id}>
//                       <td>{s.date}</td>
//                       <td>{s.itemName}</td>
//                       <td>{s.qty}</td>
//                       <td>{s.sellPrice.toFixed(2)}</td>
//                       <td>{s.total.toFixed(2)}</td>
//                       <td className={s.profit >= 0 ? "pos" : "neg"}>
//                         {s.profit.toFixed(2)}
//                       </td>
//                       <td className="actions">
//                         <button
//                           className="link-btn"
//                           onClick={() => editSale(s)}
//                         >
//                           Edit
//                         </button>
//                         <button
//                           className="link-btn danger"
//                           onClick={() => deleteSale(s.id)}
//                         >
//                           Delete
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//                 {monthSales.length > 0 && (
//                   <tfoot>
//                     <tr>
//                       <td colSpan={4}>Totals — {monthLabel(month)}</td>
//                       <td>{totals.totalSales.toFixed(2)}</td>
//                       <td className={totals.totalProfit >= 0 ? "pos" : "neg"}>
//                         {totals.totalProfit.toFixed(2)}
//                       </td>
//                       <td></td>
//                     </tr>
//                   </tfoot>
//                 )}
//               </table>
//             </div>
//           </section>
//         )}
//       </main>

//       <footer className="app-footer">
//         <div className="wrap">
//           <span>
//             © {new Date().getFullYear()} {SHOP_NAME}
//           </span>
//           {/* <span>All rights reserved</span> */}
//         </div>
//       </footer>
//     </div>
//   );
// }
