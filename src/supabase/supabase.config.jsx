import { createClient } from "@supabase/supabase-js";

const fetchWithSessionGuard = async (...args) => {
  const response = await fetch(...args);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("asc:session-expired"));
  }
  return response;
};

export const supabase = createClient(
  import.meta.env.VITE_APP_SUPABASE_URL,
  import.meta.env.VITE_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: fetchWithSessionGuard,
    },
  },
);
