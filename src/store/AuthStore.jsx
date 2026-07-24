import { create } from "zustand";
import { supabase } from "../supabase/supabase.config";

export const useAuthStore = create(() => ({
  loginGoogle: async () => {
    if (import.meta.env.VITE_APP_GOOGLE_AUTH_ENABLED !== "true") {
      throw new Error(
        "Google Auth no está configurado en Supabase. Falta Client ID y Client Secret de Google Cloud."
      );
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  },
  cerrarSesion: async () => {
    await supabase.auth.signOut();
 
  },
  loginEmail: async (p) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: p.email,
      password: p.password,
    });
    if (error) {
      if (error.status === 400) {
        throw new Error("Correo o contraseña incorrectos");
      } else {
        throw new Error("Error al iniciar sesión: " + error.message);
      }
    }
    return data.user
  },
  loginInvitadoQA: async () => {
    if (!import.meta.env.DEV) {
      throw new Error("El modo invitado QA solo está disponible en desarrollo local.");
    }

    const email = import.meta.env.VITE_APP_QA_EMAIL;
    const password = import.meta.env.VITE_APP_QA_PASSWORD;

    if (!email || !password) {
      throw new Error("Faltan VITE_APP_QA_EMAIL y VITE_APP_QA_PASSWORD en .env.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error("No se pudo iniciar el modo invitado QA: " + error.message);
    }
    return data.user
  },
}));
