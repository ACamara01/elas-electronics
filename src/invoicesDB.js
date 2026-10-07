// invoicesDb.js
// Talks to the "invoices" table in Supabase.

import { supabase } from "./supabaseClient.js";

// Database row (snake_case) -> app object (camelCase)
function fromRow(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    createdAt: row.created_at,
    date: row.invoice_date,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || "",
    customerAddress: row.customer_address || "",
    items: row.items || [], // [{ name, qty, price }]
    total: Number(row.total),
    paid: Number(row.paid),
    paymentMethod: row.payment_method || "",
    notes: row.notes || "",
  };
}

// App object -> database row
// (id, invoice_no and created_at are set by the database, so they are not sent)
function toRow(inv) {
  return {
    invoice_date: inv.date,
    customer_name: inv.customerName,
    customer_phone: inv.customerPhone,
    customer_address: inv.customerAddress,
    items: inv.items,
    total: inv.total,
    paid: inv.paid,
    payment_method: inv.paymentMethod,
    notes: inv.notes,
  };
}

// Load all invoices, newest first
export async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("invoice_no", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

// Save a new invoice and return it (now with its invoice number)
export async function insertInvoice(inv) {
  const { data, error } = await supabase
    .from("invoices")
    .insert(toRow(inv))
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

// Update an existing invoice (for example to record a later payment)
export async function updateInvoiceRow(id, inv) {
  const { data, error } = await supabase
    .from("invoices")
    .update(toRow(inv))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}


// Delete an invoice
export async function deleteInvoiceRow(id) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}