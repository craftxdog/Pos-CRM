import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://agoge-academy.web.app",
  "https://agoge-academy.firebaseapp.com",
  "https://agogesistem.alphaby.cloud",
  "http://localhost:5173",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://agoge-academy.web.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

class HttpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const asPositiveInteger = (value: unknown, label: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(`${label} inválido.`);
  }
  return parsed;
};

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
) {
  // This path is used only to recover a previously interrupted provisioning.
  // It avoids leaving an unusable Auth account when the original browser flow
  // had created credentials but had not created the application profile.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });

  let createdAuthId: string | null = null;
  let provisionedUserId: number | null = null;
  let provisionedAuthId: string | null = null;
  try {
    if (request.method !== "POST") throw new HttpError("Método no permitido.", 405);

    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new HttpError("Sesión administrativa requerida.", 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !serviceRole) {
      throw new HttpError("La función no tiene la configuración segura requerida.", 500);
    }

    const callerClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) throw new HttpError("Sesión inválida.", 401);

    const { data: caller, error: callerError } = await adminClient
      .from("usuarios")
      .select("id, id_empresa, roles(nombre)")
      .eq("id_auth", authData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    const callerRole = caller?.roles?.nombre?.toLowerCase();
    if (!caller?.id_empresa || !["superadmin", "administrador", "admin"].includes(callerRole)) {
      throw new HttpError("No tienes permiso para crear usuarios.", 403);
    }

    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.pass || body?.password || "");
    const nombres = String(body?.nombres || "").trim();
    const nroDoc = String(body?.nro_doc || "").trim().toUpperCase();
    const telefono = String(body?.telefono || "").trim();
    const idRol = asPositiveInteger(body?.id_rol, "Rol");
    const idSucursal = asPositiveInteger(body?.id_sucursal, "Sucursal");
    const idCaja = asPositiveInteger(body?.id_caja, "Caja");
    const modules = [...new Set((Array.isArray(body?.modules) ? body.modules : [])
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0))];

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError("Ingresa un correo válido.");
    if (password.length < 8) throw new HttpError("La contraseña debe tener al menos 8 caracteres.");
    if (!nombres || !nroDoc || !telefono) throw new HttpError("Completa nombres, documento y teléfono.");
    if (modules.length === 0) throw new HttpError("Selecciona al menos un módulo.");

    const [{ data: role, error: roleError }, { data: sucursal, error: sucursalError }, { data: caja, error: cajaError }, { data: validModules, error: modulesError }, { data: tenant, error: tenantError }] = await Promise.all([
      adminClient.from("roles").select("id, nombre").eq("id", idRol).maybeSingle(),
      adminClient.from("sucursales").select("id").eq("id", idSucursal).eq("id_empresa", caller.id_empresa).maybeSingle(),
      adminClient.from("caja").select("id").eq("id", idCaja).eq("id_sucursal", idSucursal).maybeSingle(),
      adminClient.from("modulos").select("id").in("id", modules),
      adminClient.from("tenants").select("id").eq("legacy_empresa_id", caller.id_empresa).maybeSingle(),
    ]);
    if (roleError || sucursalError || cajaError || modulesError || tenantError) {
      throw roleError || sucursalError || cajaError || modulesError || tenantError;
    }
    if (!role || !sucursal || !caja || !tenant || (validModules || []).length !== modules.length) {
      throw new HttpError("La sucursal, caja, rol, módulos o empresa seleccionados ya no son válidos.");
    }

    const { data: existingProfile, error: profileError } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("correo", email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (existingProfile) throw new HttpError("Ya existe un usuario con este correo.", 409);

    let authId: string;
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { id_empresa: caller.id_empresa },
    });

    if (createError) {
      const existingAuth = await findAuthUserByEmail(adminClient, email);
      if (!existingAuth) throw createError;
      authId = existingAuth.id;
      const { error: resetError } = await adminClient.auth.admin.updateUserById(authId, {
        password,
        email_confirm: true,
        app_metadata: { ...existingAuth.app_metadata, id_empresa: caller.id_empresa },
      });
      if (resetError) throw resetError;
    } else {
      authId = created.user.id;
      createdAuthId = authId;
    }
    provisionedAuthId = authId;

    const { data: newUser, error: userError } = await adminClient
      .from("usuarios")
      .insert({
        id_empresa: caller.id_empresa,
        nombres,
        nro_doc: nroDoc,
        telefono,
        id_rol: idRol,
        correo: email,
        id_auth: authId,
      })
      .select("id")
      .single();
    if (userError) throw userError;
    provisionedUserId = newUser.id;

    const { error: membershipError } = await adminClient.from("tenant_memberships").upsert({
      tenant_id: tenant.id,
      user_id: authId,
      role: ["superadmin", "administrador", "admin"].includes(role.nombre?.toLowerCase())
        ? "admin"
        : "staff",
      estado: "active",
    }, { onConflict: "tenant_id,user_id" });
    if (membershipError) throw membershipError;

    const { error: assignmentError } = await adminClient.from("asignacion_sucursal").insert({
      id_sucursal: idSucursal,
      id_usuario: newUser.id,
      id_caja: idCaja,
    });
    if (assignmentError) throw assignmentError;

    const { error: permissionsError } = await adminClient.from("permisos").insert(
      modules.map((idmodulo) => ({ id_usuario: newUser.id, idmodulo })),
    );
    if (permissionsError) throw permissionsError;

    return Response.json({ id: authId, userId: newUser.id }, { headers });
  } catch (error) {
    // Compensate every database row written by this request before removing a
    // freshly created Auth account. Existing orphaned Auth accounts are kept so
    // a retry can complete their provisioning instead of deleting credentials.
    if (provisionedUserId || createdAuthId) {
      const url = Deno.env.get("SUPABASE_URL");
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && serviceRole) {
        const adminClient = createClient(url, serviceRole, { auth: { persistSession: false } });
        if (provisionedUserId) {
          await adminClient.from("permisos").delete().eq("id_usuario", provisionedUserId);
          await adminClient.from("asignacion_sucursal").delete().eq("id_usuario", provisionedUserId);
          await adminClient.from("usuarios").delete().eq("id", provisionedUserId);
        }
        if (provisionedAuthId) {
          await adminClient.from("tenant_memberships").delete().eq("user_id", provisionedAuthId);
        }
        if (createdAuthId) await adminClient.auth.admin.deleteUser(createdAuthId);
      }
    }
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "No fue posible aprovisionar el usuario.";
    return Response.json({ error: message }, { status, headers });
  }
});
