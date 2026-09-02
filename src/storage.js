// Simple localStorage read/write helpers, with JSON handling built in.

const ITEMS_KEY = "elas_items";
const SALES_KEY = "elas_sales";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadItems() {
  return load(ITEMS_KEY, []);
}

export function saveItems(items) {
  save(ITEMS_KEY, items);
}

export function loadSales() {
  return load(SALES_KEY, []);
}

export function saveSales(sales) {
  save(SALES_KEY, sales);
}

export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
