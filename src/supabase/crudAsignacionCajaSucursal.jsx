import { supabase } from "../supabase/supabase.config";
const tabla = "asignacion_sucursal";
export async function MostrarSucursalCajaAsignada(p) {
  if (!p?.id_usuario) return null;

  const { data, error } = await supabase
    .from(tabla)
    .select(`*, sucursales(*), caja(*)`)
    .eq("id_usuario", p.id_usuario)
    .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data;
}
export async function InsertarAsignacionCajaSucursal(p) {
  const { error } = await supabase.from(tabla).insert(p);
  if (error) {
    throw new Error(error.message);
  }
}

export async function MostrarUsuariosAsignados(p) {
  return consultarUsuariosAsignados(p);
}
export async function BuscarUsuariosAsignados(p) {
  return consultarUsuariosAsignados(p);
}

async function consultarUsuariosAsignados(p) {
  if (!p?._id_empresa) return [];
  let query = supabase
    .from("usuarios")
    .select("id, nombres, correo, nro_doc, telefono, estado, id_rol, roles(nombre), asignacion_sucursal(id, sucursales(nombre), caja(descripcion))")
    .eq("id_empresa", p._id_empresa);
  if (p.buscador?.trim()) query = query.ilike("nombres", `%${p.buscador.trim()}%`);
  const { data, error } = await query.order("nombres");
  if (error) throw new Error(error.message);
  return (data || []).map((usuario) => {
    const asignacion = usuario.asignacion_sucursal?.[0];
    return {
      id_usuario: usuario.id,
      usuario: usuario.nombres,
      email: usuario.correo,
      nro_doc: usuario.nro_doc,
      telefono: usuario.telefono,
      id_rol: usuario.id_rol,
      rol: usuario.roles?.nombre || "Sin rol",
      sucursal: asignacion?.sucursales?.nombre || "Sin sucursal",
      caja: asignacion?.caja?.descripcion || "Sin caja",
      estadouser: usuario.estado || "activo",
    };
  });
}
