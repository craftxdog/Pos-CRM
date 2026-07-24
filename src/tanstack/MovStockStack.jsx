import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaStore } from "../store/EmpresaStore";
import { toast } from "sonner";
import { useUsuariosStore } from "../store/UsuariosStore";
import { useProductosStore } from "../store/ProductosStore";
import { useMovStockStore } from "../store/MovStockStore";
import { useAlmacenesStore } from "../store/AlmacenesStore";
import { useFormattedDate } from "../hooks/useFormattedDate";
import { useGlobalStore } from "../store/GlobalStore";

// export const useBuscarProductosQuery = () => {
//   const { buscador, buscarProductos } = useProductosStore();
//   const { dataempresa } = useEmpresaStore();

//   return useQuery({
//     queryKey: ["buscar productos", buscador],
//     queryFn: () =>
//       buscarProductos({
//         id_empresa: dataempresa?.id,
//         buscador: buscador,
//       }),
//     enabled: !!dataempresa,
//   });
// };
export const useInsertarMovStockMutation = () => {
  const queryClient = useQueryClient();
  const productosItemSelect = useProductosStore(
    (state) => state.productosItemSelect,
  );
  const setStateClose = useGlobalStore((state) => state.setStateClose);
  const tipo = useMovStockStore((state) => state.tipo);
  const setTipo = useMovStockStore((state) => state.setTipo);
  const insertarMovStock = useMovStockStore((state) => state.insertarMovStock);
  const almacenSelectItem = useAlmacenesStore((state) => state.almacenSelectItem);
  const fechaActual = useFormattedDate();
  const dataempresa = useEmpresaStore((state) => state.dataempresa);
  const datausuarios = useUsuariosStore((state) => state.datausuarios);
  return useMutation({
    mutationKey: ["insertar movimiento stock"],
    mutationFn: async (data) => {
      const pMovimientoStock = {
        id_empresa: dataempresa?.id,
        id_almacen: almacenSelectItem?.id,
        id_producto: productosItemSelect?.id,
        tipo_movimiento: tipo,
        cantidad: parseFloat(data.cantidad),
        fecha: fechaActual,
        detalle: "registro de inventario manual",
        origen: "inventario",
        creado_por: datausuarios?.id,
      };
      const pProductos = {
        id: productosItemSelect?.id,
        precio_compra: parseFloat(
          (productosItemSelect?.precio_compra + data.precio_compra) / 2
        ),
        precio_venta: parseFloat(
          (productosItemSelect?.precio_venta + data.precio_venta) / 2
        ),
      };
      if (!pMovimientoStock.id_empresa) {
        throw new Error("No se pudo determinar la empresa del inventario");
      }
      await insertarMovStock({
        ...pMovimientoStock,
        id_stock: null,
        precio_compra: pProductos.precio_compra,
        precio_venta: pProductos.precio_venta,
      });
    },
    onError: (error) => {
      toast.error("Error:" + error.message);
    },
    onSuccess: () => {
      toast.success("Registro guardado correctamente");
      queryClient.invalidateQueries({ queryKey: ["buscar productos"] });
      queryClient.invalidateQueries({ queryKey: ["mostrar movimientos de stock"] });
      queryClient.invalidateQueries({ queryKey: ["mostrar StockXAlmacenYProducto"] });
      queryClient.invalidateQueries({ queryKey: ["inventario stock"] });
      setTipo("ingreso");
      setStateClose(false)
    },
  });
};
