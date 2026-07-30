import { create } from "zustand";
import {
  ALL_DATE_RANGE,
  calculatePreviousDateRange,
  toLocalDateKey,
} from "../utils/dashboardDates";

const todayRange = () => {
  const today = toLocalDateKey();
  return { fechaInicio: today, fechaFin: today, activeRange: "today" };
};

export const useDashboardStore = create((set, get) => ({
  ...todayRange(),
  setRangoFechas: (inicio, fin, activeRange = "custom") =>
    set({ fechaInicio: inicio, fechaFin: fin, activeRange }),
  limpiarFechas: () => set(todayRange()),
  mostrarTodasLasFechas: () =>
    set({ ...ALL_DATE_RANGE, activeRange: "all" }),
  setFechasAnteriores: () => {
    const { fechaInicio, fechaFin } = get();
    return calculatePreviousDateRange(fechaInicio, fechaFin);
  },
}));
