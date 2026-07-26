import { supabase } from "./supabase.config";

function throwIfError(error) {
  if (error) {
    throw new Error(error.message);
  }
}

async function throwFunctionError(error) {
  if (!error) return;
  try {
    const payload = await error.context?.json();
    throw new Error(payload?.error || payload?.message || error.message);
  } catch (contextError) {
    if (contextError instanceof Error && contextError.message !== error.message) {
      throw contextError;
    }
    throw new Error(error.message);
  }
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
      .select("*, clientes_crm(nombres, apellidos, email), crm_planes(nombre, descripcion, precio, periodicidad, duracion_dias)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_pagos")
      .select(
        "*, clientes_crm(nombres, apellidos, email, telefono, direccion, identificador_nacional, identificador_fiscal), crm_suscripciones(id, fecha_inicio, fecha_fin, crm_planes(nombre, descripcion, precio, periodicidad))"
      )
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
}) {
  const { data, error } = await supabase.functions.invoke("crm-send-invitation", {
    body: {
      id_empresa,
      email,
      id_plan: id_plan || null,
    },
  });
  await throwFunctionError(error);
  return data?.invitation || data;
}

export async function CancelarInvitacionCliente({ id, id_empresa }) {
  const { data, error } = await supabase
    .from("crm_invitaciones")
    .update({ estado: "cancelada" })
    .eq("id", id)
    .eq("id_empresa", id_empresa)
    .eq("estado", "pendiente")
    .select()
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    throw new Error("La invitación ya no está pendiente");
  }
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

export async function FacturarPlanCliente(payload) {
  const { data, error } = await supabase.rpc("crm_facturar_plan", {
    p_id_cliente_crm: Number(payload.id_cliente_crm),
    p_id_plan: Number(payload.id_plan),
    p_fecha_inicio: payload.fecha_inicio || new Date().toISOString().slice(0, 10),
    p_estado: payload.estado || "pagado",
    p_metodo_pago: payload.metodo_pago || null,
    p_auto_renovar: Boolean(payload.auto_renovar),
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function MostrarCrmSuscripcionesPage({
  id_empresa,
  page = 1,
  pageSize = 10,
  search = "",
  status = "todos",
  planId = "todos",
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(5, Number(pageSize) || 10));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("crm_suscripciones_operativas")
    .select("*", { count: "exact" })
    .eq("id_empresa", id_empresa)
    .order("fecha_fin", { ascending: true })
    .order("id", { ascending: false })
    .range(from, to);

  const normalizedSearch = String(search || "").trim().toLowerCase();
  if (normalizedSearch) {
    query = query.ilike("busqueda", `%${normalizedSearch}%`);
  }
  if (status && status !== "todos") {
    query = query.eq("estado_operativo", status);
  }
  if (planId && planId !== "todos") {
    query = query.eq("id_plan", Number(planId));
  }

  const { data, error, count } = await query;
  throwIfError(error);

  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  return {
    data: data || [],
    pagination: {
      page: Math.min(safePage, totalPages),
      pageSize: safePageSize,
      total,
      totalPages,
      from: total ? from + 1 : 0,
      to: Math.min(from + safePageSize, total),
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  };
}

export async function ActualizarEstadoCrmSuscripcion({
  id,
  id_empresa,
  estado,
}) {
  if (!["activa", "pausada", "cancelada"].includes(estado)) {
    throw new Error("Estado de suscripción no permitido");
  }
  const { data, error } = await supabase
    .from("crm_suscripciones")
    .update({ estado })
    .eq("id", id)
    .eq("id_empresa", id_empresa)
    .select()
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    throw new Error("No se encontró la suscripción");
  }
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
  const { data: nuevoCliente, error } = await supabase.rpc(
    "crm_completar_invitacion",
    {
      p_invitacion_id: invitacion.id,
      p_nombres: cliente.nombres,
      p_apellidos: cliente.apellidos || null,
      p_telefono: cliente.telefono || null,
      p_direccion: cliente.direccion || null,
      p_identificador_nacional: cliente.identificador_nacional || null,
      p_identificador_fiscal: cliente.identificador_fiscal || null,
      p_fecha_nacimiento: cliente.fecha_nacimiento || null,
      p_notas: cliente.notas || null,
    }
  );
  throwIfError(error);
  return nuevoCliente;
}
