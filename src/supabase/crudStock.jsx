import { supabase } from "./supabase.config";

const tabla = "stock";
const tablaBase = "almacenes";
export async function InsertarStock(p) {
  const { error } = await supabase.from(tablaBase).insert(p);
  if (error) {
    throw new Error(error.message);
  }
}
export async function EditarStock(p, tipo) {
  const { error } = await supabase.rpc(
    tipo === "ingreso" ? "incrementarstock": "reducirstock",p
  );
  if (error) {
    throw new Error(error.message);
  }
}
export async function MostrarStockXAlmacenYProducto(p) {
  if (!p?.id_almacen || !p?.id_producto) return null;
  const { data } = await supabase
    .from(tabla)
    .select()
    .eq("id_almacen", p.id_almacen)
    .eq("id_producto", p.id_producto)
    .maybeSingle();
  return data;
}
export async function MostrarStockXAlmacenesYProducto(p) {
  if (!p?.id_almacen || !p?.id_producto) return [];
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .neq("id_almacen", p.id_almacen)
    .eq("id_producto", p.id_producto)
    .gt("stock", 0);
  if (error) throw new Error(error.message);
  return data;
}
