import Swal from "sweetalert2";
import { supabase } from "./supabase.config";
const tabla = "cierrecaja";
const tabla2 = "ingresos_salidas_caja";
export async function MostrarCierreCajaAperturada(p) {
  if (!p?.id_caja) return null;

  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_caja", p.id_caja)
    .eq("estado", 0)
    .order("fechainicio", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function AperturarCierreCaja(p) {
  const { error, data } = await supabase
    .from(tabla)
    .insert(p)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? null;
}
export async function CerrarTurnoCaja(p) {
  const { error } = await supabase.from(tabla).update(p).eq("id",p.id);
  if (error) {
    throw new Error(error.message);
  }
}
