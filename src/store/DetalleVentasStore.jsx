import { create } from "zustand";
import {
  InsertarDetalleVentas,
  MostrarDetalleVenta,
  EliminarDetalleVentas,
  Mostrartop5productosmasvendidosxcantidad,
  Mostrartop10productosmasvendidosxmonto,
  EditarCantidadDetalleVenta,
} from "../index";
import { calculateSaleTotals } from "../utils/posCalculations";
function calcularTotal(items) {
  return calculateSaleTotals(items).total;
}
export const useDetalleVentasStore = create((set, get) => ({
  datadetalleventa: [],
  parametros: {},
  total: 0,
  saleTotals: calculateSaleTotals([]),
  reemplazarDetalleLocal: (items) =>
    set({
      datadetalleventa: items,
      total: calcularTotal(items),
      saleTotals: calculateSaleTotals(items),
    }),
  mostrardetalleventa: async (p) => {
    const response = await MostrarDetalleVenta(p);
    get().reemplazarDetalleLocal(response);
    return response;
  },
  insertarDetalleVentas: async (p) => {
    await InsertarDetalleVentas(p);
  },
  eliminardetalleventa: async (p) => {
    await EliminarDetalleVentas(p);
  },
  mostrartop5productosmasvendidosxcantidad: async (p) => {
    const response = Mostrartop5productosmasvendidosxcantidad(p);
    return response;
  },
  mostrartop10productosmasvendidosxmonto: async (p) => {
    const response = Mostrartop10productosmasvendidosxmonto(p);
    return response;
  },
  editarCantidadDetalleVenta: async (p) => {
    await EditarCantidadDetalleVenta(p);
  },
}));
