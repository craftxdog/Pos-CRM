import { supabase } from "./supabase.config";

export async function MostrarAccesoTenantActual() {
  const { data, error } = await supabase.rpc("get_current_tenant_access");
  if (error) throw new Error(error.message);
  if (!data?.tenant_id) {
    throw new Error("Tu usuario no tiene una organizacion SaaS activa");
  }
  return data;
}
