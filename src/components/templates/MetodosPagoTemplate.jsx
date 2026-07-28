import styled from "styled-components";
import {
  Btn1,
  Buscador,
  RegistrarCategorias,
  Title,
  useCategoriasStore,
} from "../../index";
import { v } from "../../styles/variables";
import { TablaCategorias } from "../organismos/tablas/TablaCategorias";
import { useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { RegistrarMetodosPago } from "../organismos/formularios/RegistrarMetodosPago";
import { TablaMetodosPago } from "../organismos/tablas/TablaMetodosPago";
import { Toaster } from "sonner";
import { useMetodosPagoStore } from "../../store/MetodosPagoStore";
export function MetodosPagoTemplate() {
  const [openRegistro, SetopenRegistro] = useState(false);
  const { dataMetodosPago } = useMetodosPagoStore();
  const [accion, setAccion] = useState("");
  const [dataSelect, setdataSelect] = useState([]);
  const [isExploding, setIsExploding] = useState(false);
  function nuevoRegistro() {
    SetopenRegistro(!openRegistro);
    setAccion("Nuevo");
    setdataSelect([]);
    setIsExploding(false)
  }
  return (
    <Container>
      <Toaster richColors position="top-right"/>
      {openRegistro && (
        <RegistrarMetodosPago setIsExploding={setIsExploding}
          onClose={() => SetopenRegistro(!openRegistro)}
          dataSelect={dataSelect}
          accion={accion}
        />
      )}
      <section className="area1">
        <Title>Métodos de pago</Title>
        <Btn1
          funcion={nuevoRegistro}
          bgcolor={v.colorPrincipal}
          titulo="nuevo"
          icono={<v.iconoagregar />}
        />
      </section>
     

      <section className="main">
        {isExploding && <ConfettiExplosion />}
        <TablaMetodosPago setdataSelect={setdataSelect} setAccion={setAccion} SetopenRegistro={SetopenRegistro} data={dataMetodosPago} />
      </section>
    </Container>
  );
}
const Container = styled.div`
  min-height: calc(100dvh - 50px);
  width: 100%;
  min-width: 0;
  margin-top:50px;
  padding: clamp(10px, 3vw, 18px);
  display: grid;
  grid-template:
    "area1" auto
    "main" minmax(0, 1fr);
  gap: 12px;
  .area1 {
    grid-area: area1;
    /* background-color: rgba(103, 93, 241, 0.14); */
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
  }
  .main {
    grid-area: main;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
  }
  @media (min-width: 768px) {
    min-height: 100dvh;
    margin-top: 0;
  }
`;
