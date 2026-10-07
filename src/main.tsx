import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// One shared cache for all the data fetched from Supabase
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // data counts as fresh for 30 seconds
      // By default it also refetches when you return to the tab and retries failed requests
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
  </React.StrictMode>

);
