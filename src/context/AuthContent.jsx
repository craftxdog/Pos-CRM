import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase/supabase.config";
import { BootstrapUsuarioActual } from "../supabase/crudUsuarios";
import { useUsuariosStore } from "../store/UsuariosStore";

const defaultAuthContext = {
  user: null,
  loadingAuth: true,
};
const AuthContext = createContext(defaultAuthContext);
export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { mostrarusuarios } = useUsuariosStore();

  const insertarDatos = useCallback(async (id_auth) => {
    if (window.location.pathname.startsWith("/onboarding-cliente")) {
      return;
    }
    const usuario = await mostrarusuarios({ id_auth });
    if (usuario) {
      return usuario;
    }
    await BootstrapUsuarioActual();
    return mostrarusuarios({ id_auth });
  }, [mostrarusuarios]);
  
  useEffect(() => {
    let isMounted = true;
    let lastSessionKey;

    const syncSession = async (session) => {
      if (!isMounted) return;

      if (session == null) {
        setUser(null);
        setLoadingAuth(false);
        return;
      }

      try {
        await insertarDatos(session?.user.id);
        if (!isMounted) return;
        setUser(session?.user);
      } catch (error) {
        console.error("No se pudo sincronizar el usuario autenticado:", error);
        if (!isMounted) return;
        setUser(session?.user);
      } finally {
        if (isMounted) {
          setLoadingAuth(false);
        }
      }
    };

    const scheduleSessionSync = (session) => {
      const sessionKey = session?.access_token || "signed-out";
      if (sessionKey === lastSessionKey) return;
      lastSessionKey = sessionKey;

      // Supabase recomienda no ejecutar otras operaciones del cliente dentro
      // del lock de onAuthStateChange. Programarlas fuera evita deadlocks.
      window.setTimeout(() => {
        void syncSession(session);
      }, 0);
    };

    supabase.auth.getSession().then(({ data }) => {
      scheduleSessionSync(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      scheduleSessionSync(session);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [insertarDatos]);

  return (
    <AuthContext.Provider value={{ user, loadingAuth }}>{children}</AuthContext.Provider>
  );
};
export const UserAuth = () => {
  return useContext(AuthContext) ?? defaultAuthContext;
};
