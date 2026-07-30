import { create } from "zustand";
import { supabase } from "../supabase/supabase.config";

async function loadStockReport({ sucursal_id, almacen_id, lowStockOnly = false }) {
  if (!sucursal_id || !almacen_id) return [];

  const stockQuery = supabase
    .from("almacenes")
    .select("id_producto, stock, stock_minimo")
    .eq("id_sucursal", sucursal_id)
    .eq("id_almacen", almacen_id);

  const { data: stockRows, error: stockError } = await stockQuery;
  if (stockError) throw stockError;
  if (!stockRows?.length) return [];

  const productIds = [
    ...new Set(stockRows.map((item) => item.id_producto).filter(Boolean)),
  ];
  const { data: products, error: productsError } = await supabase
    .from("productos")
    .select("id, codigo_interno, codigo_barras, nombre, precio_compra")
    .in("id", productIds);

  if (productsError) throw productsError;

  const productsById = new Map(
    (products || []).map((item) => [String(item.id), item]),
  );

  return stockRows
    .filter(
      (item) =>
        !lowStockOnly ||
        Number(item.stock || 0) <= Number(item.stock_minimo || 0),
    )
    .map((item) => {
      const product = productsById.get(String(item.id_producto)) || {};
      const stock = Number(item.stock || 0);
      const price = Number(product.precio_compra || 0);

      return {
        codigo_articulo:
          product.codigo_interno ||
          product.codigo_barras ||
          String(item.id_producto),
        descripcion_articulo: product.nombre || "Producto sin nombre",
        stock,
        stock_minimo: Number(item.stock_minimo || 0),
        precio_costo: price,
        total: stock * price,
      };
    })
    .sort((a, b) =>
      a.descripcion_articulo.localeCompare(b.descripcion_articulo, "es"),
    );
}

export const useReportStore = create(() => ({
  reportStockPorAlmacenSucursal: (p) => loadStockReport(p),
  reportStockBajoMinimo: (p) =>
    loadStockReport({ ...p, lowStockOnly: true }),
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
