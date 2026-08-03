import { create } from "zustand";
import {
  MostrarCajaXSucursal,
  EditarCaja,
  CambiarEstadoCaja,
  DiagnosticarRetiroCaja,
} from "../supabase/crudCaja";
import { supabase } from "../supabase/supabase.config";
const tabla = "caja";
export const useCajasStore = create((set) => ({
  stateCaja: false,
  setStateCaja: (p) => set({ stateCaja: p }),
  accion: "",
  setAccion: (p) => set({ accion: p }),
  cajaSelectItem: null,
  setCajaSelectItem: (p) => {
    set({ cajaSelectItem: p });
  },

  dataCaja: null,
  mostrarCajaXSucursal: async (p) => {
    const response = await MostrarCajaXSucursal(p);
    set({ cajaSelectItem: response?.[0] ?? null });
    set({ dataCaja: response });
    return response;
  },

  insertarCaja: async (p) => {
    const { error, data } = await supabase
      .from(tabla)
      .insert(p)
      .select();

    if (error) {
      throw new Error(error.message);
    }
    return data?.[0] ?? null;
  },
  editarCaja: async (p) => {
    await EditarCaja(p);
  },
  cambiarEstadoCaja: async (p) => {
    return CambiarEstadoCaja(p);
  },
  diagnosticarRetiroCaja: async (p) => {
    return DiagnosticarRetiroCaja(p);
  },
}));
