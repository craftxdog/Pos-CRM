import { supabase } from "./supabase.config";
const tabla = "almacen";


export async function EditarAlmacen(p) {
  const { error } = await supabase.from(tabla).update(p).eq("id", p.id);
  if (error) {
    throw new Error(error.message);
  }
}
export async function InsertarAlmacen(p) {
  const { error } = await supabase.from(tabla).insert(p);
  if (error) {
    throw new Error(error.message);
  }
}

export async function MostrarAlmacenXSucursal(p) {
  if (!p?.id_sucursal) return null;
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_sucursal", p.id_sucursal)
    .eq("estado", "activa")
    .order("nombre")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
export async function MostrarAlmacenesXEmpresa(p) {
  if (!p?.id_empresa) return [];
  const { data, error } = await supabase
    .from("sucursales")
    .select(`*, almacen(*)`)
    .eq("id_empresa", p.id_empresa)
    .order("nombre");
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
export async function MostrarAlmacenesXSucursal(p) {
  if (!p?.id_sucursal) return [];
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_sucursal", p.id_sucursal)
    .eq("estado", "activa")
    .order("nombre");
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
export async function CambiarEstadoAlmacen(p) {
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

export async function DiagnosticarRetiroAlmacen(p) {
  const { data, error } = await supabase.rpc("diagnosticar_retiro_almacen", {
    _id_almacen: p.id,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("No se encontró el almacén o no tienes permiso para administrarlo.");
  }
  return data;
}
