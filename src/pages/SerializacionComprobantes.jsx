import { Link } from "react-router-dom";
import styled from "styled-components";
import { Spinner1 } from "../components/moleculas/Spinner1";
import { CrudTemplate } from "../components/templates/CrudTemplate";
import { useMostrarSerializacionesQuery } from "../tanstack/SerializacionStack";
import { useMostrarSucursalesQuery } from "../tanstack/SucursalesStack";
import { useAsignacionCajaSucursalStore } from "../store/AsignacionCajaSucursalStore";

import { TablaSerializaciones } from "../components/organismos/tablas/TablaSerializaciones";
import { RegistrarSerializacion } from "../components/organismos/formularios/RegistrarSerializacion";
export const SerializacionComprobantes = () => {
  const { sucursalesItemSelectAsignadas } = useAsignacionCajaSucursalStore();
  const {
    data: sucursales,
    isLoading: isLoadingSucursales,
    error: errorSucursales,
  } = useMostrarSucursalesQuery();
  const sucursalId =
    sucursalesItemSelectAsignadas?.id_sucursal || sucursales?.[0]?.id;
  const { data, isLoading, error } = useMostrarSerializacionesQuery(sucursalId);

  if (isLoadingSucursales || isLoading) {
    return <Spinner1 />;
  }
  if (errorSucursales || error) {
    return <EmptyState role="alert">No se pudo cargar la configuración: {(errorSucursales || error).message}</EmptyState>;
  }
  if (!sucursalId) {
    return (
      <EmptyState>
        <span className="eyebrow">Primer paso</span>
        <h1>Crea tu primera sucursal</h1>
        <p>
          La serialización pertenece a una sucursal. Al crearla se prepararán
          automáticamente su caja principal, impresora y numeración inicial.
        </p>
        <Link to="/configuracion/sucursalcaja">Crear sucursal</Link>
      </EmptyState>
    );
  }
  if (!data?.length) {
    return (
      <EmptyState>
        <span className="eyebrow">Configuración pendiente</span>
        <h1>Esta sucursal no tiene comprobantes</h1>
        <p>Actualiza la página después de crear la sucursal. Si el aviso continúa, contacta a soporte.</p>
      </EmptyState>
    );
  }
  return (
    <CrudTemplate
      data={data} FormularioRegistro={RegistrarSerializacion}
      title="Comprobantes"
      Tabla={<TablaSerializaciones data={data}/>}
     
    />
  );
};

const EmptyState = styled.section`
  width: min(620px, calc(100% - 40px));
  margin: 72px auto;
  padding: 40px;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 18px;
  background: ${({ theme }) => theme.bgcards};
  color: ${({ theme }) => theme.text};
  text-align: center;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);

  .eyebrow {
    color: #27a8ff;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 { margin: 12px 0; font-size: clamp(1.6rem, 4vw, 2.2rem); }
  p { margin: 0 auto 24px; max-width: 48ch; line-height: 1.6; color: ${({ theme }) => theme.colorSubtitle}; }
  a { display: inline-flex; padding: 12px 18px; border-radius: 10px; background: #f9d70b; color: #111; font-weight: 800; text-decoration: none; }
`;
