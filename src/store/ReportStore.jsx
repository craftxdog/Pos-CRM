import { create } from "zustand";
import { supabase } from "../supabase/supabase.config";

export const useReportStore = create(() => ({
  reportStockPorAlmacenSucursal: async (p) => {
    const { data, error } = await supabase.rpc(
      "report_stock_por_almacen_sucursal",
      p
    );
    if (error) throw error;
    return data;
  },
  reportStockBajoMinimo: async (p) => {
    const { data, error } = await supabase.rpc("report_stock_bajo_minimo", p);
    if (error) throw error;
    return data;
  },
  reportVentasPorSucursal: async (p) => {
    if (!p?.sucursal_id || !p?.fecha_inicio || !p?.fecha_fin) return [];

    const { data: ventas, error: ventasError } = await supabase
      .from("ventas")
      .select(
        "id, fecha, monto_total, total_impuestos, sub_total, tipo_de_pago, cantidad_productos, id_usuario, estado"
      )
      .eq("id_sucursal", p.sucursal_id)
      .gte("fecha", p.fecha_inicio)
      .lte("fecha", p.fecha_fin)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false });

    if (ventasError) throw ventasError;

    const userIds = [
      ...new Set((ventas || []).map((item) => item.id_usuario).filter(Boolean)),
    ];
    let usersById = new Map();

    if (userIds.length) {
      const { data: usuarios, error: usuariosError } = await supabase
        .from("usuarios")
        .select("id, nombres")
        .in("id", userIds);
      if (usuariosError) throw usuariosError;
      usersById = new Map(
        (usuarios || []).map((usuario) => [String(usuario.id), usuario.nombres])
      );
    }

    return (ventas || []).map((venta) => ({
      id_venta: venta.id,
      fecha: venta.fecha,
      monto_total: Number(venta.monto_total || 0),
      total_impuestos: Number(venta.total_impuestos || 0),
      subtotal: Number(venta.sub_total || 0),
      pago_con: venta.tipo_de_pago || "-",
      cantidad_productos: Number(venta.cantidad_productos || 0),
      cajero: usersById.get(String(venta.id_usuario)) || "Sin asignar",
      estado: venta.estado || "-",
    }));
  },
}));
