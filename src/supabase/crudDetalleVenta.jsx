import { supabase } from "./supabase.config";
const tabla = "detalle_venta";
export async function InsertarDetalleVentas(p) {
  const { error } = await supabase.rpc("insertardetalleventa", p);
  if (error) {
    throw new Error(error.message);
  }
}
export async function EditarCantidadDetalleVenta(p) {
  const isUuid = typeof p?._id === "string" && p._id.includes("-");
  const { data, error } = await supabase.rpc(
    isUuid ? "editar_cantidad_detalle_uuid" : "editarcantidaddv",
    p
  );
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
export async function MostrarDetalleVenta(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select(`*, ventas(*),productos(*)`)
    .eq("id_venta", p.id_venta);
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function EliminarDetalleVentas(p) {
  const column = p.public_id ? "public_id" : "id";
  const value = p.public_id || p.id;
  const { error } = await supabase.from(tabla).delete().eq(column, value);
  if (error) {
    throw new Error(error.message);
  }
}
export async function Mostrartop5productosmasvendidosxcantidad(p) {
  const { data, error } = await supabase.rpc(
    "mostrartop5productosmasvendidosxcantidad",
    p
  );
  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}
export async function Mostrartop10productosmasvendidosxmonto(p) {
  const { data, error } = await supabase.rpc(
    "mostrartop10productosmasvendidosxmonto",
    p
  );
  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}
