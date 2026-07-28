import styled from "styled-components";
import { Btn1, Buscador, Title } from "../../index";
import { v } from "../../styles/variables";
import ConfettiExplosion from "react-confetti-explosion";
import { Toaster } from "sonner";
import { BuscadorList } from "../ui/lists/BuscadorList";
import { useGlobalStore } from "../../store/GlobalStore";
export function CrudTemplate({
  FormularioRegistro,
  title,
  Tabla,
  data,
  setBuscador,
  tipoBuscador,
  dataBuscadorList,
  selectBuscadorList,
  setBuscadorList,stateBtnAdd,stateBuscador
}) {
  const {stateClose,isExploding,setItemSelect,setAccion,setIsExploding,setStateClose} = useGlobalStore() 

 
  function nuevoRegistro() {
    setStateClose(true);
    setAccion("Nuevo");
    setItemSelect([]);
    setIsExploding(false);
  }
  return (
    <Container>
      <Toaster position="top-right" />
      {stateClose && FormularioRegistro && (
        <FormularioRegistro
        />
      )}
      <section className="area1">
        <Title>{title} </Title>
        {
          stateBtnAdd &&   <Btn1
          funcion={nuevoRegistro}
          bgcolor={v.colorPrincipal}
          titulo="nuevo"
          icono={<v.iconoagregar />}
        />
        }
      
      </section>
      {
          stateBuscador &&   <section className="area2">
        
        {tipoBuscador === "list" ? (
          <BuscadorList
            data={dataBuscadorList}
            onSelect={selectBuscadorList}
            setBuscador={setBuscadorList}
          />
        ) : (
          <Buscador setBuscador={setBuscador} />
        )}
      </section>
        }
     

      <section className="main">
        {isExploding && <ConfettiExplosion />}
        {data?.length > 0 && Tabla}
      </section>
    </Container>
  );
}
const Container = styled.div`
  min-height: calc(100vh - 50px);
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
    /* background-color: rgba(237, 7, 221, 0.14); */
    min-height: 0;
    max-width: 100%;
    overflow-x: auto;
  }

  @media (min-width: 768px) {
    min-height: 100vh;
    min-height: 100dvh;
    margin-top: 0;
  }
`;
