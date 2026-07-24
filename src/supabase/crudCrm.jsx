import { supabase } from "./supabase.config";

function throwIfError(error) {
  if (error) {
    throw new Error(error.message);
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function MostrarCrmData({ id_empresa }) {
  const [
    clientes,
    planes,
    horarios,
    invitaciones,
    suscripciones,
    pagos,
    asistencias,
    cargos,
    trabajadores,
    empresaModulos,
    rolModulos,
    modulos,
    roles,
    resumen,
    whatsappConfig,
    whatsappPlantillas,
    whatsappMensajes,
    automatizaciones,
  ] = await Promise.all([
    supabase
      .from("clientes_crm")
      .select("*")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_planes")
      .select("*")
      .eq("id_empresa", id_empresa)
      .order("nombre", { ascending: true }),
    supabase
      .from("crm_horarios")
      .select("*")
      .eq("id_empresa", id_empresa)
      .order("hora_entrada", { ascending: true }),
    supabase
      .from("crm_invitaciones")
      .select("*, crm_planes(nombre, precio, periodicidad)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_suscripciones")
      .select("*, clientes_crm(nombres, apellidos, email), crm_planes(nombre)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_pagos")
      .select("*, clientes_crm(nombres, apellidos, email)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_asistencias")
      .select("*, clientes_crm(nombres, apellidos), crm_horarios(nombre)")
      .eq("id_empresa", id_empresa)
      .order("fecha", { ascending: false }),
    supabase
      .from("cargos")
      .select("*")
      .eq("id_empresa", id_empresa)
      .order("nombre", { ascending: true }),
    supabase
      .from("trabajadores")
      .select("*, cargos(nombre), crm_horarios(nombre)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("empresa_modulos")
      .select("*, modulos(*)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("rol_modulos")
      .select("*, roles(*), modulos(*)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("modulos")
      .select("*")
      .or("etiquetas.eq.#crm,link.eq./crm")
      .order("nombre", { ascending: true }),
    supabase.from("roles").select("*").neq("nombre", "superadmin"),
    supabase
      .from("crm_resumen_clientes")
      .select("*")
      .eq("id_empresa", id_empresa)
      .maybeSingle(),
    supabase
      .from("crm_whatsapp_config")
      .select("*")
      .eq("id_empresa", id_empresa)
      .maybeSingle(),
    supabase
      .from("crm_whatsapp_plantillas")
      .select("*")
      .eq("id_empresa", id_empresa)
      .order("tipo", { ascending: true }),
    supabase
      .from("crm_whatsapp_mensajes")
      .select(
        "*, clientes_crm(nombres, apellidos, telefono, email), crm_pagos(monto, moneda, estado, fecha_vencimiento, referencia), crm_suscripciones(fecha_fin, estado)"
      )
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("crm_automatizaciones")
      .select("*")
      .eq("id_empresa", id_empresa)
      .order("evento", { ascending: true }),
  ]);

  [
    clientes,
    planes,
    horarios,
    invitaciones,
    suscripciones,
    pagos,
    asistencias,
    cargos,
    trabajadores,
    empresaModulos,
    rolModulos,
    modulos,
    roles,
    resumen,
    whatsappConfig,
    whatsappPlantillas,
    whatsappMensajes,
    automatizaciones,
  ].forEach((result) => throwIfError(result.error));

  return {
    clientes: clientes.data || [],
    planes: planes.data || [],
    horarios: horarios.data || [],
    invitaciones: invitaciones.data || [],
    suscripciones: suscripciones.data || [],
    pagos: pagos.data || [],
    asistencias: asistencias.data || [],
    cargos: cargos.data || [],
    trabajadores: trabajadores.data || [],
    empresaModulos: empresaModulos.data || [],
    rolModulos: rolModulos.data || [],
    modulos: modulos.data || [],
    roles: roles.data || [],
    resumen: resumen.data || null,
    whatsappConfig: whatsappConfig.data || null,
    whatsappPlantillas: whatsappPlantillas.data || [],
    whatsappMensajes: whatsappMensajes.data || [],
    automatizaciones: automatizaciones.data || [],
  };
}

export async function InsertarCrmCliente(payload) {
  const { data, error } = await supabase
    .from("clientes_crm")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function EditarCrmCliente(payload) {
  const { id, ...values } = payload;
  const { data, error } = await supabase
    .from("clientes_crm")
    .update(values)
    .eq("id", id)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function EnviarInvitacionCliente({
  id_empresa,
  email,
  id_plan,
  invited_by,
  redirectTo,
}) {
  const token = crypto.randomUUID();
  const token_hash = await sha256(token);
  const { data, error } = await supabase
    .from("crm_invitaciones")
    .insert({
      id_empresa,
      email,
      id_plan: id_plan || null,
      invited_by,
      token_hash,
    })
    .select()
    .maybeSingle();
  throwIfError(error);

  const { error: authError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  throwIfError(authError);
  return data;
}

export async function InsertarCrmPlan(payload) {
  const { data, error } = await supabase
    .from("crm_planes")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function InsertarCrmHorario(payload) {
  const { data, error } = await supabase
    .from("crm_horarios")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function InsertarCrmSuscripcion(payload) {
  const { data, error } = await supabase
    .from("crm_suscripciones")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function InsertarCrmPago(payload) {
  const { data, error } = await supabase
    .from("crm_pagos")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function InsertarCrmAsistencia(payload) {
  const { data, error } = await supabase
    .from("crm_asistencias")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function InsertarCargo(payload) {
  const { data, error } = await supabase
    .from("cargos")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function InsertarTrabajador(payload) {
  const { data, error } = await supabase
    .from("trabajadores")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function UpsertEmpresaModulo(payload) {
  const { data, error } = await supabase
    .from("empresa_modulos")
    .upsert(payload, { onConflict: "id_empresa,idmodulo" })
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function UpsertRolModulo(payload) {
  const { data, error } = await supabase
    .from("rol_modulos")
    .upsert(payload, { onConflict: "id_empresa,id_rol,idmodulo" })
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function UpsertWhatsappConfig(payload) {
  const { data, error } = await supabase
    .from("crm_whatsapp_config")
    .upsert(payload, { onConflict: "id_empresa" })
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function EditarWhatsappPlantilla(payload) {
  const { id, ...values } = payload;
  const { data, error } = await supabase
    .from("crm_whatsapp_plantillas")
    .update(values)
    .eq("id", id)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function CrearWhatsappMensaje(payload) {
  const { data, error } = await supabase
    .from("crm_whatsapp_mensajes")
    .insert(payload)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function ActualizarWhatsappMensaje(payload) {
  const { id, ...values } = payload;
  const { data, error } = await supabase
    .from("crm_whatsapp_mensajes")
    .update(values)
    .eq("id", id)
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function UpsertCrmAutomatizacion(payload) {
  const { data, error } = await supabase
    .from("crm_automatizaciones")
    .upsert(payload, { onConflict: "id_empresa,evento,canal" })
    .select()
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function DespacharWhatsappMensaje({ id, mode = "template" }) {
  const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", {
    body: {
      message_id: id,
      mode,
    },
  });
  throwIfError(error);
  return data;
}

export async function MostrarInvitacionClienteActual() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  throwIfError(userError);

  if (!user?.email) {
    return null;
  }

  const { data, error } = await supabase
    .from("crm_invitaciones")
    .select("*, crm_planes(*)")
    .ilike("email", user.email)
    .eq("estado", "pendiente")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function CompletarInvitacionCliente({ invitacion, cliente }) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  throwIfError(userError);

  const { data: nuevoCliente, error } = await supabase
    .from("clientes_crm")
    .insert({
      ...cliente,
      id_empresa: invitacion.id_empresa,
      email: user.email,
      id_auth: user.id,
      estado: "activo",
      origen: "invitacion",
    })
    .select()
    .maybeSingle();
  throwIfError(error);

  const { error: inviteError } = await supabase
    .from("crm_invitaciones")
    .update({
      estado: "aceptada",
      accepted_at: new Date().toISOString(),
      id_cliente_crm: nuevoCliente.id,
    })
    .eq("id", invitacion.id);
  throwIfError(inviteError);

  return nuevoCliente;
}
