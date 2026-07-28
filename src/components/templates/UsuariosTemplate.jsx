import styled from "styled-components";
import {
  Btn1,
  Buscador,
  RegistrarCategorias,
  Title,
  useCategoriasStore,
  useUsuariosStore,
} from "../../index";
import { RegistrarUsuarios } from "../organismos/formularios/RegistrarUsuarios";
import { v } from "../../styles/variables";
import { TablaCategorias } from "../organismos/tablas/TablaCategorias";
import { useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { Toaster } from "sonner";
import { useAsignacionCajaSucursalStore } from "../../store/AsignacionCajaSucursalStore";
import { TablaUsuarios } from "../organismos/tablas/TablaUsuarios";
export function UsuariosTemplate() {
  const [openRegistro, SetopenRegistro] = useState(false);
  const [dataSelect, setdataSelect] = useState([]);
  const {setItemSelect} = useUsuariosStore()
  const [isExploding, setIsExploding] = useState(false);
  const {accion,setAccion,datausuariosAsignados,setBuscador} = useAsignacionCajaSucursalStore()
  function nuevoRegistro() {
    SetopenRegistro(!openRegistro);
    setAccion("Nuevo");
    setdataSelect([]);
    setIsExploding(false);
    setItemSelect(null)
  }
  return (
    <Container>
      <Toaster />
      {openRegistro && (
        <RegistrarUsuarios
          setIsExploding={setIsExploding}
          onClose={() => SetopenRegistro(!openRegistro)}
          dataSelect={dataSelect}
          accion={accion}
        />
      )}

      <section className="area1">
        <Title>Usuarios</Title>
        <Btn1
          funcion={nuevoRegistro}
          bgcolor={v.colorPrincipal}
          titulo="nuevo"
          icono={<v.iconoagregar />}
        />
      </section>
      <section className="area2">
        <Buscador setBuscador={setBuscador} />
      </section>

      <section className="main">
        {isExploding && <ConfettiExplosion />}
        <TablaUsuarios
          setdataSelect={setItemSelect}
          setAccion={setAccion}
          SetopenRegistro={SetopenRegistro}
          data={datausuariosAsignados}
        />
      </section>
    </Container>
  );
}
const Container = styled.div`
  min-height: calc(100dvh - 50px);
  width: 100%;
  min-width: 0;
  margin-top: 50px;
  padding: clamp(10px, 3vw, 18px);
  display: grid;
  grid-template:
    "area1" auto
    "area2" auto
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
  .area2 {
    grid-area: area2;
    /* background-color: rgba(7, 237, 45, 0.14); */
    display: flex;
    justify-content: stretch;
    align-items: center;

    > * {
      width: min(100%, 420px);
      margin-left: auto;
    }
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
