import { supabase } from "./supabase.config";
const tabla = "caja";
export async function MostrarCajaXSucursal(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_sucursal", p.id_sucursal)
    .eq("estado", "activa")
    .order("descripcion");

  if (error) {
    throw new Error(error.message);
  }
  return data;
}


export async function EditarCaja(p) {
  const { error } = await supabase.from(tabla).update(p).eq("id", p.id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function CambiarEstadoCaja(p) {
  const { data, error } = await supabase
    .from(tabla)
    .update({ estado: p.estado })
    .eq("id", p.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function DiagnosticarRetiroCaja(p) {
  const { data, error } = await supabase.rpc("diagnosticar_retiro_caja", {
    _id_caja: p.id,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("No se encontró la caja o no tienes permiso para administrarla.");
  }
  return data;
}
