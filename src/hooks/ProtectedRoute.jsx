import { Navigate, useLocation } from "react-router-dom";
import { UserAuth } from "../context/AuthContent";
import { usePermisosStore } from "../store/PermisosStore";
import { useQuery } from "@tanstack/react-query";
import { useUsuariosStore } from "../store/UsuariosStore";
import { Spinner1 } from "../components/moleculas/Spinner1";
import { useTenantAccessStore } from "../store/TenantAccessStore";
import { supabase } from "../supabase/supabase.config";

function requiredFeature(pathname) {
  if (pathname === "/miperfil") return null;
  if (pathname === "/crm/whatsapp") return "whatsapp_automation";
  if (pathname.startsWith("/crm") || pathname === "/configuracion/crm") return "crm";
  return "pos";
}

function formatAccessDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-NI", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SubscriptionRequired({ feature, message, access }) {
  const labels = {
    pos: "Punto de venta",
    crm: "CRM",
    whatsapp_automation: "Automatizacion de WhatsApp",
  };
  const subscription = access?.subscription;
  const periodEnded =
    subscription?.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now();
  const title = periodEnded
    ? subscription?.status === "trialing"
      ? "El periodo de prueba finalizó"
      : "La suscripción necesita atención"
    : `${labels[feature] || "Módulo"} no está habilitado`;
  const detail =
    message ||
    (periodEnded
      ? `El acceso venció el ${formatAccessDate(subscription.current_period_end)}. Renueva o actualiza el plan para continuar.`
      : "La suscripción de esta organización no incluye este módulo o necesita regularizarse.");

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/login");
  };

  return (
    <main
      style={{
        padding: "clamp(28px, 8vw, 72px) 24px",
        maxWidth: "720px",
        margin: "0 auto",
      }}
    >
      <small>ACTIVESELFCONTROL · ACCESO DEL PLAN</small>
      <h1>{title}</h1>
      <p>{detail}</p>
      {subscription?.plan_name ? (
        <p>
          Plan actual: <strong>{subscription.plan_name}</strong>
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "24px" }}>
        <button type="button" onClick={() => window.location.reload()}>
          Comprobar de nuevo
        </button>
        <button type="button" onClick={signOut}>
          Cerrar sesión
        </button>
      </div>
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
    enabled: accessBy === "authenticated" && !!user,
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

  if (loadingAuth) {
    return <Spinner1 />;
  }

  if (accessBy === "non-authenticated") {
    if (!user) {
      return children;
    } else {
      return <Navigate to="/" />;
    }
  } else if (accessBy === "authenticated") {
    if (user) {
      if (isLoadingTenant) {
        return <Spinner1 />;
      }

      if (tenantError) {
        return <SubscriptionRequired message={tenantError.message} />;
      }

      const feature = requiredFeature(location.pathname);
      if (feature && tenantAccess?.features?.[feature] !== true) {
        return (
          <SubscriptionRequired
            feature={feature}
            access={tenantAccess}
          />
        );
      }

      if (isLoadingUsuario) {
        return <Spinner1 />;
      }

      if (errorUsuario || !datausuarios?.id) {
        return (
          <main style={{ padding: "48px", maxWidth: "720px", margin: "0 auto" }}>
            <h1>No se pudo cargar tu perfil</h1>
            <p>
              {errorUsuario?.message ||
                "La sesión es válida, pero no existe un perfil operativo asociado."}
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </main>
        );
      }

      if (isLoadingPermisosGlobales) {
        return <Spinner1 />;
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
