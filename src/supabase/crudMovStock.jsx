import { supabase } from "./supabase.config";
const tabla = "movimientos_stock";
export async function MostrarMovStock(p) {
  if (!p?.id_empresa || !p?.id_producto) return [];
  const { data, error } = await supabase
    .from(tabla)
    .select("*, almacen!inner(nombre, sucursales!inner(nombre))")
    .eq("id_empresa", p.id_empresa)
    .eq("id_producto", p.id_producto);
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function InsertarMovStock(p) {
  const { error } = await supabase.rpc("registrar_movimiento_inventario", {
    _id_empresa: p.id_empresa,
    _id_almacen: p.id_almacen,
    _id_producto: p.id_producto,
    _id_stock: p.id_stock ?? null,
    _tipo_movimiento: p.tipo_movimiento,
    _cantidad: p.cantidad,
    _fecha: p.fecha,
    _detalle: p.detalle,
    _origen: p.origen,
    _creado_por: p.creado_por,
    _precio_compra: p.precio_compra,
    _precio_venta: p.precio_venta,
  });
  if (error) {
    throw new Error(error.message);
  }
}
