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
    let validationInFlight = false;
    let authSubscription;

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
      } catch {
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

    const validateSession = async () => {
      if (validationInFlight || !isMounted) return;
      validationInFlight = true;

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          await supabase.auth.signOut({ scope: "local" });
          scheduleSessionSync(null);
          return;
        }

        if (!session) {
          scheduleSessionSync(null);
          return;
        }

        // getSession lee el almacenamiento local. getUser confirma con Auth
        // que el JWT sigue siendo válido antes de disparar las consultas del POS.
        const {
          data: { user: verifiedUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !verifiedUser) {
          await supabase.auth.signOut({ scope: "local" });
          scheduleSessionSync(null);
          return;
        }

        scheduleSessionSync({ ...session, user: verifiedUser });
      } catch {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        scheduleSessionSync(null);
      } finally {
        validationInFlight = false;
      }
    };

    const initializeAuth = async () => {
      // Validate and remove a stale persisted session before registering the
      // initial auth listener. Otherwise gotrue logs the expected refresh-token
      // failure while both initialization paths race for the same session.
      await validateSession();
      if (!isMounted) return;

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        scheduleSessionSync(session);
      });
      authSubscription = data.subscription;
    };

    void initializeAuth();

    const revalidateWhenActive = () => {
      if (document.visibilityState === "visible") {
        void validateSession();
      }
    };

    window.addEventListener("focus", revalidateWhenActive);
    window.addEventListener("online", revalidateWhenActive);
    document.addEventListener("visibilitychange", revalidateWhenActive);
    const handleExpiredSession = () => {
      setUser(null);
      setLoadingAuth(false);
      void supabase.auth.signOut({ scope: "local" });
    };
    window.addEventListener("asc:session-expired", handleExpiredSession);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", revalidateWhenActive);
      window.removeEventListener("online", revalidateWhenActive);
      document.removeEventListener("visibilitychange", revalidateWhenActive);
      window.removeEventListener("asc:session-expired", handleExpiredSession);
      authSubscription?.unsubscribe();
    };
  }, [insertarDatos]);

  return (
    <AuthContext.Provider value={{ user, loadingAuth }}>{children}</AuthContext.Provider>
  );
};
export const UserAuth = () => {
  return useContext(AuthContext) ?? defaultAuthContext;
};
