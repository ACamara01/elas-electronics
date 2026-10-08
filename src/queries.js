// queries.js
// Shared data hooks (React Query).
// Any component can call these and gets the SAME cached data,
// so switching tabs shows the last data instantly while fresh data loads quietly.

import { useQuery } from "@tanstack/react-query";
import { fetchItems, fetchSales } from "./db.js";

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
}

export function useSales() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: () => fetchSales(),
  });
}