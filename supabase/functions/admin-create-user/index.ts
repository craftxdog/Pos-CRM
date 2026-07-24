import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sesión administrativa requerida");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data: claims, error: claimsError } = await callerClient.auth.getUser();
    if (claimsError || !claims.user) throw new Error("Sesión inválida");

    const { data: caller } = await adminClient.from("usuarios")
      .select("id_empresa, roles(nombre)").eq("id_auth", claims.user.id).single();
    const role = caller?.roles?.nombre?.toLowerCase();
    if (!caller?.id_empresa || !["superadmin", "administrador", "admin"].includes(role)) {
      throw new Error("No tienes permiso para crear usuarios");
    }

    const { email, password } = await request.json();
    if (!email || !password || password.length < 6) throw new Error("Email y contraseña válida son requeridos");
    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      app_metadata: { id_empresa: caller.id_empresa },
    });
    if (error) throw error;
    return Response.json({ id: data.user.id }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
  }
});
