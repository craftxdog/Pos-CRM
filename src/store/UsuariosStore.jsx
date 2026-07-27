import { create } from "zustand";
import {
  EditarUsuarios,
  EditarPerfilUsuario,
  EliminarUsuarioAsignado,
  InsertarCredencialesUser,
} from "../supabase/crudUsuarios";
import { usePermisosStore } from "./PermisosStore";
import { supabase } from "../supabase/supabase.config";
const tabla = "usuarios";
export const useUsuariosStore = create((set) => ({
  refetchs: null,
  datausuarios: [],
  itemSelect: null,
  setItemSelect: (p) => set({ itemSelect: p }),
  mostrarusuarios: async (p) => {
    try {
      const { data, error } = await supabase
        .from(tabla)
        .select(`*, roles(*)`)
        .eq("id_auth", p.id_auth)
        .maybeSingle();

      if (error) {
        console.error("💥 Supabase error en MostrarUsuarios:", error);
        throw new Error(error.message);
      }

      set({ datausuarios: data });
      return data;
    } catch (err) {
      console.error("🔥 ERROR inesperado:", err);
      throw err;
    }
  },
  eliminarUsuarioAsignado: async (p) => {
    await EliminarUsuarioAsignado(p);
  },
  insertarUsuario: async (p) => {
    const modules = [...new Set(usePermisosStore.getState().selectedModules || [])]
      .map(Number)
      .filter(Number.isInteger);

    if (!p?.id_empresa) throw new Error("No se encontró la empresa activa.");
    if (!p?.id_rol) throw new Error("Selecciona el rol del usuario.");
    if (!p?.id_sucursal) throw new Error("Selecciona una sucursal.");
    if (!p?.id_caja) throw new Error("Selecciona una caja para el usuario.");
    if (!p?.email || !p?.pass) throw new Error("Correo y contraseña son obligatorios.");
    if (modules.length === 0) throw new Error("Selecciona al menos un módulo.");

    // The Edge Function validates the tenant and writes profile, assignment and
    // permissions as one server-side provision. Auth is compensated on failure.
    return InsertarCredencialesUser({ ...p, modules });
  },
  editarUsuarios: async (p) => {
    await EditarUsuarios(p);
  },
  editarPerfilUsuario: async (p) => {
    await EditarPerfilUsuario(p);
  },
  editarThemeUser: async (p) => {
    const { error } = await supabase.from(tabla).update(p).eq("id", p.id);
    if (error) {
      throw new Error(error.message);
    }
  },
}));
