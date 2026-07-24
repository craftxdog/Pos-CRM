import { create } from "zustand";
import {
  EditarImpresoras,
  MostrarImpresoraXCaja,
} from "../supabase/crudImpresoras";
const fetchWithTimeout = (url, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    fetch(url)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};
const printServiceUrl = import.meta.env.VITE_PRINT_SERVICE_URL ||
  (navigator.userAgent.includes("Mac") ? null : "http://localhost:5075");
export const getPrintServiceUrl = () => printServiceUrl;
export const useImpresorasStore = create((set, get) => ({
  dataImpresorasPorCaja: null,
  selectImpresora: {
    name: "seleccione una impresora",
  },
  setSelectImpresora: (p) => {
    set({ selectImpresora: p });
  },
  statePrintDirecto: false,
  setStatePrintDirecto: () => {
    set((state) => ({ statePrintDirecto: !state.statePrintDirecto }));
  },
  mostrarDatosPc: async () => {
    if (!printServiceUrl) return null;
    try {
      const response = await fetchWithTimeout(
        `${printServiceUrl}/api/get-local-ip`,
        5000
      );
      if (!response.ok) {
        throw new Error(`Error de red: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return null;
    }
  },
  mostrarListaImpresoraLocales: async () => {
    if (!printServiceUrl) return [];
    const response = await fetch(`${printServiceUrl}/api/list`).catch(() => null);
    if (!response) return [];
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    return data;
  },
  editarImpresoras: async (p) => {
    await EditarImpresoras(p);
  },
  mostrarImpresoraXCaja: async (p) => {
    const response = await MostrarImpresoraXCaja(p);
    set(() => ({
      dataImpresorasPorCaja: response,
      statePrintDirecto: response?.state,
      selectImpresora:
        response?.name === "-"
          ? {
              name: "seleccione una impresora",
            }
          : response,
    }));
    return response;
  },
  
}));
