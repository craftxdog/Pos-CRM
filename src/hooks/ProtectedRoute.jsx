import { Navigate, useLocation } from "react-router-dom";
import { UserAuth } from "../context/AuthContent";
import { usePermisosStore } from "../store/PermisosStore";
import { useQuery } from "@tanstack/react-query";
import { useUsuariosStore } from "../store/UsuariosStore";
import { Spinner1 } from "../components/moleculas/Spinner1";
import { useTenantAccessStore } from "../store/TenantAccessStore";

function requiredFeature(pathname) {
  if (pathname === "/miperfil") return null;
  if (pathname === "/crm/whatsapp") return "whatsapp_automation";
  if (pathname.startsWith("/crm") || pathname === "/configuracion/crm") return "crm";
  return "pos";
}

function SubscriptionRequired({ feature, message }) {
  const labels = {
    pos: "Punto de venta",
    crm: "CRM",
    whatsapp_automation: "Automatizacion de WhatsApp",
  };
  return (
    <main style={{ padding: "48px", maxWidth: "720px", margin: "0 auto" }}>
      <small>ACTIVESELFCONTROL · ACCESO DEL PLAN</small>
      <h1>{labels[feature] || "Modulo"} no esta habilitado</h1>
      <p>
        {message ||
          "La suscripcion de esta organizacion no incluye este modulo o necesita regularizarse."}
      </p>
    </main>
  );
}

export const ProtectedRoute = ({ children, accessBy }) => {
  const { user, loadingAuth } = UserAuth() ?? {
    user: null,
    loadingAuth: true,
  };
  const {mostrarPermisosGlobales } = usePermisosStore();
  const location = useLocation();
  const {datausuarios, mostrarusuarios} = useUsuariosStore()
  const { cargarAcceso } = useTenantAccessStore();
  const shouldLoadUsuario =
    accessBy === "authenticated" && !!user?.id && !datausuarios?.id;

  const {
    isLoading: isLoadingUsuario,
    error: errorUsuario,
  } = useQuery({
    queryKey: ["mostrar usuarios", user?.id],
    queryFn: () => mostrarusuarios({ id_auth: user?.id }),
    enabled: shouldLoadUsuario,
    refetchOnWindowFocus: false,
  });

  const shouldLoadPermissions =
    accessBy === "authenticated" && !!user && !!datausuarios?.id;

  const {
    data: tenantAccess,
    isLoading: isLoadingTenant,
    error: tenantError,
  } = useQuery({
    queryKey: ["tenant-access", user?.id],
    queryFn: cargarAcceso,
    enabled: shouldLoadPermissions,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data:dataPermisosGlobales,
    isLoading: isLoadingPermisosGlobales,
  } = useQuery({
    queryKey: ["mostrar permisos globales", datausuarios?.id],
    queryFn: () => mostrarPermisosGlobales({ id_usuario: datausuarios?.id }),
    enabled: shouldLoadPermissions,
  });

  if (
    loadingAuth ||
    isLoadingUsuario ||
    (accessBy === "authenticated" && user && !datausuarios?.id)
  ) {
    return <Spinner1 />;
  }

  if (errorUsuario) {
    return <span>error sesión...{errorUsuario.message}</span>;
  }

  if (accessBy === "non-authenticated") {
    if (!user) {
      return children;
    } else {
      return <Navigate to="/" />;
    }
  } else if (accessBy === "authenticated") {
    if (user) {
      if (isLoadingPermisosGlobales || isLoadingTenant) {
        return <Spinner1 />;
      }

      if (tenantError) {
        return <SubscriptionRequired message={tenantError.message} />;
      }

      const feature = requiredFeature(location.pathname);
      if (feature && tenantAccess?.features?.[feature] !== true) {
        return <SubscriptionRequired feature={feature} />;
      }

      const hasPermission = dataPermisosGlobales?.some(
        (item) => item.modulos?.link === location.pathname
      );
      const isAdmin = ["superadmin", "administrador", "admin"].includes(
        datausuarios?.roles?.nombre?.toLowerCase()
      );
      // A staff member with an active tenant and a branch/cash-box assignment
      // must always be able to enter their operational home and POS. Additional
      // CRM and configuration routes still require an explicit module grant.
      const isBaselineOperationalRoute = ["/", "/pos", "/miperfil"].includes(
        location.pathname,
      );

      if (!hasPermission && !isAdmin && !isBaselineOperationalRoute) {
        return <Navigate to="/404" />;
      } 
 
      return children;
    }
  }
  return <Navigate to="/login" />;
};
