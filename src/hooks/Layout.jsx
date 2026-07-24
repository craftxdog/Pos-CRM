import styled from "styled-components";
import { Sidebar } from "../components/organismos/sidebar/Sidebar";
import { MenuMovil } from "../components/organismos/sidebar/MenuMovil";
import { SwitchHamburguesa } from "../components/moleculas/SwitchHamburguesa";
import { Spinner1 } from "../components/moleculas/Spinner1";
import { useEmpresaStore } from "../store/EmpresaStore";
import { useUsuariosStore } from "../store/UsuariosStore";
import { UserAuth } from "../context/AuthContent";
import { useState } from "react";
import { Device } from "../styles/breakpoints";
import { useQuery } from "@tanstack/react-query";
import { useMostrarSucursalAsignadasQuery } from "../tanstack/AsignacionesSucursalStack";

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stateMenu, setStateMenu] = useState(false);

  const { datausuarios } = useUsuariosStore();
  const { mostrarempresa } = useEmpresaStore();
  const { user } = UserAuth() ?? { user: null };
  const id_auth = user?.id;

  const {
    isLoading: isLoadingSucursales,
    error: errorSucursales,
  } = useMostrarSucursalAsignadasQuery();

  const {
    isLoading: isLoadingEmpresa,
    error: errorEmpresa,
  } = useQuery({
    queryKey: ["mostrar empresa", datausuarios?.id_empresa || datausuarios?.id],
    queryFn: () =>
      mostrarempresa({
        id_empresa: datausuarios?.id_empresa,
        _id_usuario: datausuarios?.id,
      }),
    enabled: !!datausuarios?.id,
    refetchOnWindowFocus: false,
  });

  // Consolidación de isLoading y error
  const isLoading =
    (!!id_auth && !datausuarios?.id) || isLoadingSucursales || isLoadingEmpresa;
  const error = errorSucursales || errorEmpresa;

  if (isLoading) {
    return <Spinner1 />;
  }
  if (error) {
    return <span>error layout...{error.message} </span>;
  }
  return (
    <Container className={sidebarOpen ? "active" : ""}>
      <section className="contentSidebar">
        <Sidebar
          state={sidebarOpen}
          setState={() => setSidebarOpen(!sidebarOpen)}
        />
      </section>
      <section className="contentMenuhambur">
        <SwitchHamburguesa
          state={stateMenu}
          setstate={() => setStateMenu(!stateMenu)}
        />
        {stateMenu ? <MenuMovil setState={() => setStateMenu(false)} /> : null}
      </section>

      <Containerbody>{children}</Containerbody>
    </Container>
  );
}
const Container = styled.main`
  display: grid;
  grid-template-columns: 1fr;
  transition: 0.1s ease-in-out;
  color: ${({ theme }) => theme.text};
  .contentSidebar {
    display: none;
    /* background-color: rgba(78, 45, 78, 0.5); */
  }
  .contentMenuhambur {
    position: absolute;
    /* background-color: rgba(53, 219, 11, 0.5); */
  }
  @media ${Device.tablet} {
    grid-template-columns: 88px 1fr;
    &.active {
      grid-template-columns: 260px 1fr;
    }
    .contentSidebar {
      display: initial;
    }
    .contentMenuhambur {
      display: none;
    }
  }
`;
const Containerbody = styled.section`
  /* background-color: rgba(231, 13, 136, 0.5); */
  grid-column: 1;
  width: 100%;

  @media ${Device.tablet} {
    margin-top: 0;
    grid-column: 2;
  }
`;
