import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const shouldRetryQuery = (failureCount, error) => {
  const status = Number(error?.status || error?.statusCode || 0);
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: 0,
    },
  },
});
const rootElement = document.getElementById("root");
const root = globalThis.__activeSelfControlRoot || ReactDOM.createRoot(rootElement);
globalThis.__activeSelfControlRoot = root;

root.render(
  <React.StrictMode>
   
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
   
  </React.StrictMode>
);
