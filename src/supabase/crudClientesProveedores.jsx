import { supabase } from "./supabase.config";
const tabla = "clientes_proveedores";
export async function InsertarClientesProveedores(p) {
  const { error, data } = await supabase.from(tabla).insert({
    nombres: p._nombres,
    id_empresa: p._id_empresa,
    direccion: p._direccion,
    telefono: p._telefono,
    email: p._email,
    identificador_nacional: p._identificador_nacional,
    identificador_fiscal: p._identificador_fiscal,
    tipo: p._tipo,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function MostrarClientesProveedores(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_empresa", p.id_empresa)
    .eq("tipo", p.tipo);
  if (error) {
    return;
  }
  return data;
}
export async function BuscarClientesProveedores(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_empresa", p.id_empresa)
    .eq("tipo", p.tipo)
    .ilike("nombres", "%"+p.buscador+"%");
  if (error) {
    return;
  }
  return data;
}
export async function EliminarClientesProveedores(p) {
  const { error } = await supabase.from(tabla).delete().eq("id", p.id);
  if (error) {
    throw new Error(error.message);
  }
}
export async function EditarClientesProveedores(p) {
  const { error } = await supabase.from(tabla).update({
    nombres: p._nombres,
    direccion: p._direccion,
    telefono: p._telefono,
    email: p._email,
    identificador_nacional: p._identificador_nacional,
    identificador_fiscal: p._identificador_fiscal,
    tipo: p._tipo,
  }).eq("id", p._id).eq("id_empresa", p._id_empresa);
  if (error) throw new Error(error.message);
}
