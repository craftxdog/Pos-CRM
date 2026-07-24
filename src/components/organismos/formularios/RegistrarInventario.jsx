import styled from "styled-components";
import { v } from "../../../styles/variables";
import {
  InputText,
  Btn1,
  useSucursalesStore,
  useEmpresaStore,
  useProductosStore,
  useAlmacenesStore,
} from "../../../index";
import { useForm } from "react-hook-form";
import { BtnClose } from "../../ui/buttons/BtnClose";
import { useQuery } from "@tanstack/react-query";
import { useMovStockStore } from "../../../store/MovStockStore";
import { BuscadorList } from "../../ui/lists/BuscadorList";
import { SelectList } from "../../ui/lists/SelectList";
import { RadioChecks } from "../../ui/toggles/RadioChecks";
import { useGlobalStore } from "../../../store/GlobalStore";
import { useInsertarMovStockMutation } from "../../../tanstack/MovStockStack";
import { MessageComponent } from "../../ui/messages/MessageComponent";
import { useEffect, useState } from "react";
import { BuscarProductos } from "../../../supabase/crudProductos";
import { MostrarSucursales } from "../../../supabase/crudSucursales";
import { MostrarAlmacenesXSucursal } from "../../../supabase/crudAlmacenes";
import { MostrarStockXAlmacenYProducto } from "../../../supabase/crudStock";
export function RegistrarInventario() {
  const setStateClose = useGlobalStore((state) => state.setStateClose);
  const dataempresa = useEmpresaStore((state) => state.dataempresa);
  const [busquedaProducto, setBusquedaProducto] = useState("");

  const tipo = useMovStockStore((state) => state.tipo);
  const selectProductos = useProductosStore((state) => state.selectProductos);
  const productosItemSelect = useProductosStore((state) => state.productosItemSelect);
  const resetProductosItemSelect = useProductosStore(
    (state) => state.resetProductosItemSelect,
  );
  const {
    register,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm({
    defaultValues: {
      precio_compra: productosItemSelect?.precio_compra,
      precio_venta: productosItemSelect?.precio_venta,
    },
  });
  useEffect(() => {
    setValue("cantidad", "");
    setValue("precio_compra", productosItemSelect?.precio_compra ?? 0);
    setValue("precio_venta", productosItemSelect?.precio_venta ?? 0);
  }, [productosItemSelect?.id, productosItemSelect?.precio_compra, productosItemSelect?.precio_venta, setValue]);

  const terminoBusqueda = busquedaProducto.trim();
  const { data: productosEncontrados = [], isFetching: buscandoProductos } =
    useQuery({
      queryKey: ["buscar productos inventario", dataempresa?.id, terminoBusqueda],
      queryFn: () =>
        BuscarProductos({
          id_empresa: dataempresa.id,
          buscador: terminoBusqueda,
        }),
      enabled: Boolean(dataempresa?.id && terminoBusqueda.length >= 2),
      staleTime: 30_000,
    });
  const selectSucursal = useSucursalesStore((state) => state.selectSucursal);
  const sucursalesItemSelect = useSucursalesStore(
    (state) => state.sucursalesItemSelect,
  );
  const setAlmacenSelectItem = useAlmacenesStore(
    (state) => state.setAlmacenSelectItem,
  );
  const almacenSelectItem = useAlmacenesStore((state) => state.almacenSelectItem);

  const { data: dataSucursales = [], isLoading: isLoadingSucursal } = useQuery({
    queryKey: ["inventario sucursales", dataempresa?.id],
    queryFn: () => MostrarSucursales({ id_empresa: dataempresa.id }),
    enabled: Boolean(dataempresa?.id),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!dataSucursales.length) return;
    const selectionIsValid = dataSucursales.some(
      (item) => item.id === sucursalesItemSelect?.id,
    );
    if (!selectionIsValid) selectSucursal(dataSucursales[0]);
  }, [dataSucursales, selectSucursal, sucursalesItemSelect?.id]);

  const { data: dataAlmacenes = [], isLoading: isLoadingAlmacenes } = useQuery({
    queryKey: ["inventario almacenes", sucursalesItemSelect?.id],
    queryFn: () =>
      MostrarAlmacenesXSucursal({ id_sucursal: sucursalesItemSelect.id }),
    enabled: Boolean(sucursalesItemSelect?.id),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!dataAlmacenes.length) return;
    const selectionIsValid = dataAlmacenes.some(
      (item) => item.id === almacenSelectItem?.id,
    );
    if (!selectionIsValid) setAlmacenSelectItem(dataAlmacenes[0]);
  }, [almacenSelectItem?.id, dataAlmacenes, setAlmacenSelectItem]);

  const { data: dataStock } = useQuery({
    queryKey: [
      "inventario stock",
      almacenSelectItem?.id,
      productosItemSelect?.id,
    ],
    queryFn: () =>
      MostrarStockXAlmacenYProducto({
        id_almacen: almacenSelectItem.id,
        id_producto: productosItemSelect.id,
      }),
    enabled: Boolean(almacenSelectItem?.id && productosItemSelect?.id),
    staleTime: 30_000,
  });

  const { mutate, isPending } = useInsertarMovStockMutation();

  const isLoading = isLoadingSucursal || isLoadingAlmacenes;
  if (isLoading) {
    return <span>cargando almacenes...</span>;
  }
  // if (error) {
  //   return <span>error...{error.message} </span>;
  // }
  return (
    <Container>
      {isPending ? (
        <span>guardando...🔼</span>
      ) : (
        <div className="sub-contenedor">
          <RadioChecks />
          <div className="headers">
            <section>
              <h1>
                {tipo == "ingreso" ? "REGISTRAR ENTRADA" : "REGISTRAR SALIDA"}
              </h1>
            </section>

            <section>
              <BtnClose
                funcion={() => {
                  resetProductosItemSelect();
                  setStateClose(false);
                }}
              />
            </section>
          </div>
          <section className="containerListas">
            <BuscadorList
              data={productosEncontrados}
              onSelect={selectProductos}
              setBuscador={setBusquedaProducto}
            />
            {buscandoProductos && <small>Buscando productos...</small>}
            <span>
              Producto:{" "}
              <strong>
                {productosItemSelect?.nombre
                  ? productosItemSelect?.nombre
                  : "-"}{" "}
              </strong>
            </span>
            <span>
              Stock:{" "}
              <strong>
                {productosItemSelect?.id && dataStock?.stock != null
                  ? dataStock.stock
                  : "-"}{" "}
              </strong>
            </span>

            <ContainerSelector>
              <label>Sucursal:</label>
              <SelectList
                data={dataSucursales}
                itemSelect={sucursalesItemSelect}
                onSelect={selectSucursal}
                displayField="nombre"
              />
            </ContainerSelector>
            <ContainerSelector>
              <label>Almacen:</label>
              <SelectList
                data={dataAlmacenes}
                itemSelect={almacenSelectItem}
                onSelect={setAlmacenSelectItem}
                displayField="nombre"
              />
            </ContainerSelector>
          </section>
          {productosItemSelect?.maneja_inventarios ? (
            <form className="formulario" onSubmit={handleSubmit(mutate)}>
              <section className="form-subcontainer">
                <article>
                  <InputText icono={<v.iconoflechaderecha />}>
                    <input
                      className="form__field"
                      type="number"
                      min="0.01"
                      step="0.01"
                      {...register("cantidad", {
                        required: true,
                        min: 0.01,
                        validate: (value) =>
                          tipo !== "salida" ||
                          Number(value) <= Number(dataStock?.stock || 0) ||
                          `Stock insuficiente. Disponible: ${dataStock?.stock || 0}`,
                      })}
                    />
                    <label className="form__label">Cantidad</label>
                    {errors.cantidad?.type === "required" && (
                      <p>Campo requerido</p>
                    )}
                    {errors.cantidad?.type === "min" && (
                      <p>La cantidad debe ser mayor que cero</p>
                    )}
                    {errors.cantidad?.type === "validate" && (
                      <p>{errors.cantidad.message}</p>
                    )}
                  </InputText>
                </article>
                <article>
                  <InputText icono={<v.iconoflechaderecha />}>
                    <input
                      className="form__field"
                      type="number"
                      {...register("precio_compra", {
                        required: true,
                      })}
                    />
                    <label className="form__label">Precio costo</label>
                    {errors.precio_compra?.type === "required" && (
                      <p>Campo requerido</p>
                    )}
                  </InputText>
                </article>
                <article>
                  <InputText icono={<v.iconoflechaderecha />}>
                    <input
                      className="form__field"
                      type="number"
                      {...register("precio_venta", {
                        required: true,
                      })}
                    />
                    <label className="form__label">Precio venta</label>
                    {errors.precio_venta?.type === "required" && (
                      <p>Campo requerido</p>
                    )}
                  </InputText>
                </article>

                <Btn1
                  disabled={!productosItemSelect?.nombre}
                  icono={<v.iconoguardar />}
                  titulo="Guardar"
                  bgcolor="#F9D70B"
                />
              </section>
            </form>
          ) : (
            <MessageComponent
              text={
                productosItemSelect?.nombre
                  ? "Este producto no maneja inventarios, dirijase a configuración > productos y realice el cambio "
                  : "Busque un producto"
              }
            />
          )}
        </div>
      )}
    </Container>
  );
}
const Container = styled.div`
  transition: 0.5s;
  top: 0;
  left: 0;
  position: fixed;
  display: flex;
  width: 100%;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
  .sub-contenedor {
    position: relative;
    width: 500px;
    max-width: 85%;
    border-radius: 20px;
    background: ${({ theme }) => theme.body};
    box-shadow: -10px 15px 30px rgba(10, 9, 9, 0.4);
    padding: 13px 36px 20px 36px;
    z-index: 100;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    .containerListas {
      gap: 20px;
      display: flex;
      flex-direction: column;
    }
    .contentSucursal {
      display: flex;
      gap: 10px;
    }
    .headers {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h1 {
        font-size: 30px;
        font-weight: 700;
        text-transform: uppercase;
      }
      span {
        font-size: 20px;
        cursor: pointer;
      }
    }
    .formulario {
      .form-subcontainer {
        gap: 20px;
        display: flex;
        flex-direction: column;
        .colorContainer {
          .colorPickerContent {
            padding-top: 15px;
            min-height: 50px;
          }
        }
      }
    }
  }
`;

export const ContainerSelector = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  position: relative;
`;
