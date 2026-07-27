import { supabase } from "./supabase.config";
import { EliminarPermisos, InsertarPermisos } from "./crudPermisos";
import { usePermisosStore } from "../store/PermisosStore";
const tabla = "usuarios";
export async function MostrarUsuarios(p) {
  const { data, error } = await supabase
    .from(tabla)
    .select(`*, roles(*)`)
    .eq("id_auth", p.id_auth)
    .maybeSingle();
  if (error) {
    return;
  }
  return data;
}
export async function BootstrapUsuarioActual() {
  const { data, error } = await supabase
    .rpc("bootstrap_current_user")
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
export async function InsertarAdmin(p) {
  const { error } = await supabase.from(tabla).insert(p);
  if (error) {
    throw new Error(error.message);
  }
}
export async function InsertarUsuarios(p) {
  const { error, data } = await supabase
    .from(tabla)
    .insert(p)
    .select()
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function InsertarCredencialesUser(p) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: p,
  });
  if (error) {
    let message = data?.error || error.message;
    try {
      const payload = await error.context?.clone?.().json?.();
      message = payload?.error || message;
    } catch {
      // The platform error is still useful when the response has no JSON body.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data?.id;
}
export async function ObtenerIdAuthSupabase() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session != null) {
    const { user } = session;
    const idauth = user.id;
    return idauth;
  }
}
export async function EliminarUsuarioAsignado(p) {
  const { error } = await supabase.from(tabla).delete().eq("id", p.id);
  if (error) {
    throw new Error(error.message);
  }
}
export async function EditarUsuarios(p) {
  const selectModules = usePermisosStore.getState().selectedModules || [];
  if (!Array.isArray(selectModules) || selectModules.length === 0) {
    throw new Error("No hay módulos seleccionados");
  }
  const { id, ...payload } = p;
  const { error } = await supabase.from(tabla).update(payload).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  await EliminarPermisos({ id_usuario: id });
  await Promise.all(
    selectModules.map((idModule) =>
      InsertarPermisos({ id_usuario: id, idmodulo: idModule }),
    ),
  );
}

export async function EditarPerfilUsuario(p) {
  const { id, nombres, nro_doc, telefono, direccion, tema } = p;
  const payload = Object.fromEntries(
    Object.entries({ nombres, nro_doc, telefono, direccion, tema }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  const { error } = await supabase.from(tabla).update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}
