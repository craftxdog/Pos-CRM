import styled from "styled-components";
import { RegistrarSucursal } from "../organismos/formularios/RegistrarSucursal";
import { Toaster } from "sonner";
import { useSucursalesStore } from "../../store/SucursalesStore";
import { ListAlmacenes } from "../organismos/AlmacenesDesign/ListAlmacenes";
import { RegistrarAlmacen } from "../organismos/formularios/RegistrarAlmacen";
import { useAlmacenesStore } from "../../store/AlmacenesStore";
export const AlmacenesTemplate = () => {
  const { stateSucursal, setStateSucursal } = useSucursalesStore();
  const { stateAlmacen } = useAlmacenesStore();

  return (
    <Container>
      <Toaster position="top-right" />
      {stateSucursal && <RegistrarSucursal />}
      {stateAlmacen && <RegistrarAlmacen />}

      <section className="area1">
        <Header>
          <Title>Almacenes por sucursal</Title>
          <Subtitle>
            Retira almacenes sin existencias y conserva todo el historial.
          </Subtitle>
         
        </Header>
      </section>
      <section className="area2">
        <ListAlmacenes />
      </section>
    </Container>
  );
};
const Container = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  min-width: 0;
  display: grid;
  position: relative;
  grid-template:
    "area1" minmax(210px, auto)
    "area2" auto;
  .area1 {
    grid-area: area1;
    /* background-color: rgba(7, 237, 45, 0.14); */
    display: flex;
    flex-direction: column;
  }
  .area2 {
    grid-area: area2;
    /* background-color: rgba(237, 7, 221, 0.14); */
    padding-bottom: 20px;
    min-width: 0;
  }
`;
const Header = styled.div`
  margin-bottom: 20px;
  text-align: center;
  justify-content: center;
  margin: auto;
  padding: 62px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (min-width: 768px) {
    padding-top: 24px;
  }
`;
const Title = styled.h3`
  font-size: 25px;
  font-weight: bold;
  color: ${({ theme }) => theme.text};
  margin: 0;
`;
const Subtitle = styled.p`
  font-size: 18px;
  color: #6b7280;
  margin: 5px 0 0;
`;
