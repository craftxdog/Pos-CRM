import { useQuery } from "@tanstack/react-query";
import { useEmpresaStore } from "../store/EmpresaStore";

import { useDashboardStore } from "../store/DashboardStore";
import { useReportesStore } from "../store/ReportesStore";
import { useSucursalesStore } from "../store/SucursalesStore";
import { useReportStore } from "../store/ReportStore";
import { useAlmacenesStore } from "../store/AlmacenesStore";
export const useMostrarVentasDashboardQuery = () => {
  const { dataempresa } = useEmpresaStore();
  const { fechaInicio, fechaFin } = useDashboardStore();
  const { mostrarVentasDashboard } = useReportesStore();
  return useQuery({
    queryKey: [
      "mostrar Ventas Dashboard",
      {
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      },
    ],
    queryFn: () =>
      mostrarVentasDashboard({
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      }),
    enabled: Boolean(dataempresa?.id && fechaInicio && fechaFin),
  });
};
export const useMostrarCantidadDetalleVentaDashboardQuery = () => {
  const { dataempresa } = useEmpresaStore();
  const { fechaInicio, fechaFin } = useDashboardStore();
  const { mostrarCantidadDetalleVentasDashboard } = useReportesStore();
  return useQuery({
    queryKey: [
      "mostrar cantidad detalle Ventas Dashboard",
      {
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      },
    ],
    queryFn: () =>
      mostrarCantidadDetalleVentasDashboard({
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      }),
    enabled: Boolean(dataempresa?.id && fechaInicio && fechaFin),
  });
};
export const useMostrarCantidadDetalleVentaPeriodoAnteriorDashboardQuery =
  () => {
    const { dataempresa } = useEmpresaStore();
    const { setFechasAnteriores } = useDashboardStore();
    const { mostrarCantidadDetalleVentasDashboard } = useReportesStore();
    const fechasAnteriores = setFechasAnteriores();
    const hasPreviousRange = Boolean(
      fechasAnteriores.fechaAnteriorInicio && fechasAnteriores.fechaAnteriorFin
    );
    return useQuery({
      queryKey: [
        "mostrar cantidad detalle Ventas Dashboard periodo anterior",
        {
          _id_empresa: dataempresa?.id,
          _fecha_inicio: fechasAnteriores?.fechaAnteriorInicio,
          _fecha_fin: fechasAnteriores?.fechaAnteriorFin,
        },
      ],
      queryFn: () =>
        mostrarCantidadDetalleVentasDashboard({
          _id_empresa: dataempresa?.id,
          _fecha_inicio: fechasAnteriores?.fechaAnteriorInicio,
          _fecha_fin: fechasAnteriores?.fechaAnteriorFin,
        }),
      enabled: Boolean(dataempresa?.id && hasPreviousRange),
    });
  };
export const useMostrarVentasDashboardPeriodoAnteriorQuery = () => {
  const { dataempresa } = useEmpresaStore();
  const { setFechasAnteriores } = useDashboardStore();

  const { mostrarVentasDashboardPeriodoAnterior } = useReportesStore();
  const fechasAnteriores = setFechasAnteriores();
  const hasPreviousRange = Boolean(
    fechasAnteriores.fechaAnteriorInicio && fechasAnteriores.fechaAnteriorFin
  );
  return useQuery({
    queryKey: [
      "mostrar Ventas Dashboard periodo anterior",
      {
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechasAnteriores?.fechaAnteriorInicio,
        _fecha_fin: fechasAnteriores?.fechaAnteriorFin,
      },
    ],
    queryFn: () =>
      mostrarVentasDashboardPeriodoAnterior({
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechasAnteriores?.fechaAnteriorInicio,
        _fecha_fin: fechasAnteriores?.fechaAnteriorFin,
      }),
    enabled: Boolean(dataempresa?.id && hasPreviousRange),
    refetchOnWindowFocus: false,
  });
};
export const useGananciasDetalleVentaQuery = () => {
  const { dataempresa } = useEmpresaStore();
  const { fechaInicio, fechaFin } = useDashboardStore();

  const { mostrarGananciasDetalleVenta } = useReportesStore();

  return useQuery({
    queryKey: [
      "mostrar ganancias detalle venta",
      {
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      },
    ],
    queryFn: () =>
      mostrarGananciasDetalleVenta({
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      }),
    enabled: Boolean(dataempresa?.id && fechaInicio && fechaFin),
    refetchOnWindowFocus: false,
  });
};
export const useReporteInventarioValoradoQuery = () => {
  const { sucursalesItemSelect } = useSucursalesStore();
  const { reportStockPorAlmacenSucursal } = useReportStore();
  const { almacenSelectItem } = useAlmacenesStore();

  return useQuery({
    queryKey: [
      "reporte de inventario valorado",
      {
        sucursal_id: sucursalesItemSelect?.id,
        almacen_id: almacenSelectItem?.id,
      },
    ],
    queryFn: () =>
      reportStockPorAlmacenSucursal({
        sucursal_id: sucursalesItemSelect?.id,
        almacen_id: almacenSelectItem?.id,
      }),
    enabled: Boolean(sucursalesItemSelect?.id && almacenSelectItem?.id),
    refetchOnWindowFocus: false,
  });
};
