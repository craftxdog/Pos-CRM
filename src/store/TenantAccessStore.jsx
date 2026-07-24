import { create } from "zustand";
import { MostrarAccesoTenantActual } from "../supabase/crudTenantAccess";

export const useTenantAccessStore = create((set) => ({
  tenant: null,
  features: {},
  cargarAcceso: async () => {
    const tenant = await MostrarAccesoTenantActual();
    set({ tenant, features: tenant.features || {} });
    return tenant;
  },
  limpiarAcceso: () => set({ tenant: null, features: {} }),
}));
