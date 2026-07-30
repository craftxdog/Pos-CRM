import styled from "styled-components";
import { Sidebar } from "../components/organismos/sidebar/Sidebar";
import { MenuMovil } from "../components/organismos/sidebar/MenuMovil";
import { SwitchHamburguesa } from "../components/moleculas/SwitchHamburguesa";
import { Spinner1 } from "../components/moleculas/Spinner1";
import { useEmpresaStore } from "../store/EmpresaStore";
import { useUsuariosStore } from "../store/UsuariosStore";
import { UserAuth } from "../context/AuthContent";
import { useEffect, useState } from "react";
import { Device } from "../styles/breakpoints";
import { useQuery } from "@tanstack/react-query";
import { useMostrarSucursalAsignadasQuery } from "../tanstack/AsignacionesSucursalStack";

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const savedPreference = window.localStorage.getItem("asc:sidebar-open");
    if (savedPreference !== null) return savedPreference === "true";
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [stateMenu, setStateMenu] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("asc:sidebar-open", String(sidebarOpen));
  }, [sidebarOpen]);

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
    isLoadingSucursales || isLoadingEmpresa;
  const error = errorSucursales || errorEmpresa;

  // ProtectedRoute owns authentication and tenant-access recovery. Rendering
  // it immediately avoids a circular spinner when an expired feature gate
  // hides the legacy user profile that Layout normally waits for.
  if (id_auth && !datausuarios?.id) {
    return children;
  }

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
          setState={setSidebarOpen}
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
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: clip;
  transition: 0.1s ease-in-out;
  color: ${({ theme }) => theme.text};
  .contentSidebar {
    display: none;
    /* background-color: rgba(78, 45, 78, 0.5); */
  }
  .contentMenuhambur {
    position: fixed;
    top: max(8px, env(safe-area-inset-top));
    left: max(8px, env(safe-area-inset-left));
    z-index: 1100;
  }
  @media ${Device.tablet} {
    grid-template-columns: 88px minmax(0, 1fr);
    &.active {
      grid-template-columns: 260px minmax(0, 1fr);
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
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;

  @media ${Device.tablet} {
    margin-top: 0;
    grid-column: 2;
  }
`;
