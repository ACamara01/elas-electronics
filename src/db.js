import { supabase } from "./supabaseClient.js";

function rowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    buyPrice: Number(row.buy_price),
    sellPrice: Number(row.sell_price),
  };
}

function rowToSale(row) {
  return {
    id: row.id,
    date: row.date,
    itemId: row.item_id,
    itemName: row.item_name,
    qty: Number(row.qty),
    sellPrice: Number(row.sell_price),
    buyPrice: Number(row.buy_price),
    total: Number(row.total),
    profit: Number(row.profit),
  };
}

// ---------- ITEMS ----------

export async function fetchItems() {
  const { data, error } = await supabase.from("items").select("*").order("name");
  if (error) throw error;
  return data.map(rowToItem);
}

export async function insertItem({ name, buyPrice, sellPrice }) {
  const { data, error } = await supabase
    .from("items")
    .insert({ name, buy_price: buyPrice, sell_price: sellPrice })
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

export async function updateItemRow(id, { name, buyPrice, sellPrice }) {
  const { data, error } = await supabase
    .from("items")
    .update({ name, buy_price: buyPrice, sell_price: sellPrice })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

export async function deleteItemRow(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

// ---------- SALES ----------

export async function fetchSales() {
  const { data, error } = await supabase.from("sales").select("*").order("date");
  if (error) throw error;
  return data.map(rowToSale);
}

export async function insertSale(sale) {
  const { data, error } = await supabase
    .from("sales")
    .insert({
      date: sale.date,
      item_id: sale.itemId,
      item_name: sale.itemName,
      qty: sale.qty,
      sell_price: sale.sellPrice,
      buy_price: sale.buyPrice,
      total: sale.total,
      profit: sale.profit,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSale(data);
}

export async function updateSaleRow(id, sale) {
  const { data, error } = await supabase
    .from("sales")
    .update({
      date: sale.date,
      item_id: sale.itemId,
      item_name: sale.itemName,
      qty: sale.qty,
      sell_price: sale.sellPrice,
      buy_price: sale.buyPrice,
      total: sale.total,
      profit: sale.profit,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToSale(data);
}

export async function deleteSaleRow(id) {
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}
