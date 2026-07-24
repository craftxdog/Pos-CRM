import { create } from "zustand";
import { supabase } from "../supabase/supabase.config";

function validDateOrNull(value) {
  if (!value || value === "Invalid Date") return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function dashboardParams(params = {}) {
  const idEmpresa = Number(params._id_empresa ?? params.id_empresa);
  if (!Number.isFinite(idEmpresa) || idEmpresa <= 0) {
    throw new Error("Empresa no definida para consultar reportes.");
  }

  return {
    _id_empresa: idEmpresa,
    _fecha_inicio: validDateOrNull(params._fecha_inicio),
    _fecha_fin: validDateOrNull(params._fecha_fin),
  };
}

export const useReportesStore = create((set, get) => ({
  totalventas: 0,
  totalventasAnterior: 0,
  porcentajeCambio: 0,
  totalCantidadDetalleVentas:0,
  totalGanancias:0,
  resetearventas: () =>
    set({
      idventa: 0,
    }),
  mostrarVentasDashboard: async (p) => {
    const { data, error } = await supabase.rpc(
      "dashboartotalventasconfechas",
      dashboardParams(p)
    );
    if (error) {
      throw new Error(error.message);
    }
    const rows = Array.isArray(data) ? data : [];
    // Calcular el total general en el frontend
    const totalGeneral = rows.reduce(
      (sum, venta) => sum + Number(venta.total_ventas),
      0
    );
    set({ totalventas: totalGeneral });
    get().setCalcularPorcentajeCambio();
    return rows;
  },
  mostrarCantidadDetalleVentasDashboard: async (p) => {
    const { data, error } = await supabase.rpc(
      "dashboardsumarcantidaddetalleventa",
      dashboardParams(p)
    );
    if (error) {
      throw new Error(error.message);
    }
    const total = Number(data || 0);
set({totalCantidadDetalleVentas: total})
    return total;
  },
  mostrarVentasDashboardPeriodoAnterior: async (p) => {
    const { data, error } = await supabase.rpc(
      "dashboardsumarventasporempresaperiodoanterior",
      dashboardParams(p)
    );
    if (error) {
      throw new Error(error.message);
    }
    const total = Number(data || 0);
    set({ totalventasAnterior: total });
    get().setCalcularPorcentajeCambio();
    return total;
  },
  mostrarGananciasDetalleVenta: async (p) => {
    const { data, error } = await supabase.rpc(
      "dashboardsumargananciadetalleventa",
      dashboardParams(p)
    ); 
    if (error) {
      throw new Error(error.message);
    }
    const total = Number(data || 0);
    set({totalGanancias: total})
    return total;
  },
  setCalcularPorcentajeCambio: () => {
    const { totalventas, totalventasAnterior } = get();

    const result =
      totalventasAnterior > 0
        ? ((totalventas - totalventasAnterior) / totalventasAnterior) * 100
        : 0;
    set({ porcentajeCambio: parseFloat(result.toFixed(2)) }); // Limita a 2 decimales y convierte a número
  },
}));
