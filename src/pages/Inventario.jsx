import styled from "styled-components";
import { RegistrarInventario } from "../components/organismos/formularios/RegistrarInventario";
import { TablaInventarios } from "../components/organismos/tablas/TablaInventarios";
import { useQuery } from "@tanstack/react-query";

import { useEmpresaStore } from "../store/EmpresaStore";
import { useProductosStore } from "../store/ProductosStore";
import { Title } from "../components/atomos/Title";
import { Btn1 } from "../components/moleculas/Btn1";
import { BuscadorList } from "../components/ui/lists/BuscadorList";
import { useGlobalStore } from "../store/GlobalStore";
import { BuscarProductos } from "../supabase/crudProductos";
import { MostrarMovStock } from "../supabase/crudMovStock";
export const Inventario = () => {
  const dataempresa = useEmpresaStore((state) => state.dataempresa);
  const buscador = useProductosStore((state) => state.buscador);
  const productosItemSelect = useProductosStore(
    (state) => state.productosItemSelect,
  );
  const setBuscador = useProductosStore((state) => state.setBuscador);
  const selectProductos = useProductosStore((state) => state.selectProductos);
  const resetProductosItemSelect = useProductosStore(
    (state) => state.resetProductosItemSelect,
  );
  const setStateClose = useGlobalStore((state) => state.setStateClose);
  const setAccion = useGlobalStore((state) => state.setAccion);
  const stateClose = useGlobalStore((state) => state.stateClose);
  const terminoBusqueda = buscador.trim();

  const { data: dataproductos = [] } = useQuery({
    queryKey: ["buscar productos", dataempresa?.id, terminoBusqueda],
    queryFn: () =>
      BuscarProductos({
        id_empresa: dataempresa?.id,
        buscador: terminoBusqueda,
      }),
    enabled: Boolean(dataempresa?.id && terminoBusqueda.length >= 2),
    staleTime: 30_000,
  });

  const { data = [] } = useQuery({
    queryKey: [
      "mostrar movimientos de stock",
      {
        id_empresa: dataempresa?.id,
        id_producto: productosItemSelect?.id,
      },
    ],
    queryFn: () =>
      MostrarMovStock({
        id_empresa: dataempresa?.id,
        id_producto: productosItemSelect?.id,
      }),
    // The inventory ledger must be useful before a product is selected.  A
    // product selection narrows the same query; an empty selection shows all
    // movements for the active company.
    enabled: Boolean(dataempresa?.id),
    staleTime: 30_000,
  });

  function nuevoRegistro() {
    setStateClose(true);
    setAccion("Nuevo");
  }
  return (
    <Container>
      {stateClose && <RegistrarInventario />}

      <section className="area1">
        {productosItemSelect?.nombre && (
          <>
            <span>
              Producto: <strong>{productosItemSelect.nombre}</strong>
            </span>
            <span aria-hidden="true">|</span>
          </>
        )}
        <Title>Inventario</Title>
        <Btn1 funcion={nuevoRegistro} titulo="Registrar" />
      </section>
      <section className="area2">
        <BuscadorList
          setBuscador={setBuscador}
          data={dataproductos}
          onSelect={selectProductos}
          onClear={resetProductosItemSelect}
        />
      </section>

      <section className="main">
        <TablaInventarios
          setAccion={setAccion}
          data={data}
        />
      </section>
    </Container>
  );
};
const Container = styled.div`
  height: calc(100vh - 80px);

  margin-top: 50px;
  padding: 15px;
  display: grid;
  grid-template:
    "area1" 60px
    "area2" 60px
    "main" auto;
  .area1 {
    grid-area: area1;
    /* background-color: rgba(103, 93, 241, 0.14); */
    display: flex;
    justify-content: end;
    align-items: center;
    gap: 15px;
  }
  .area2 {
    grid-area: area2;
    /* background-color: rgba(7, 237, 45, 0.14); */
    display: flex;
    justify-content: end;
    align-items: center;
  }
  .main {
    grid-area: main;
    /* background-color: rgba(237, 7, 221, 0.14); */
  }
`;
