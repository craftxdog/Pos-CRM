import { supabase } from "./supabase.config";

function throwIfError(error) {
  if (error) {
    const crmError = new Error(normalizeCrmError(error.message));
    if (String(error.message || "").includes("saas_crm_feature_gate")) {
      crmError.code = "TENANT_ACCESS_REQUIRED";
    }
    throw crmError;
  }
}

function normalizeCrmError(message) {
  const detail = String(message || "");
  if (detail.includes("CRM_DUPLICATE_ACTIVE_SUBSCRIPTION")) {
    return "Este cliente ya tiene este plan activo. Usa Editar para corregir las fechas o Renovar para extender la vigencia.";
  }
  if (detail.includes("saas_crm_feature_gate")) {
    return "El acceso al CRM de esta organización no está vigente. Actualiza el plan o recarga la sesión antes de intentarlo de nuevo.";
  }
  if (
    detail.includes("MS42225") ||
    detail.toLowerCase().includes("trial account unique recipients limit")
  ) {
    return "MailerSend alcanzó el límite de destinatarios únicos de la cuenta de prueba. Verifica el dominio o actualiza el plan de MailerSend antes de invitar nuevos correos.";
  }
  if (
    detail.includes("ERR_CONNECTION_CLOSED") ||
    detail.toLowerCase().includes("failed to fetch") ||
    detail.toLowerCase().includes("network request failed")
  ) {
    return "No se pudo conectar con el servicio de correo. Verifica el SMTP de Hostinger (host, puerto, cifrado y credenciales) e inténtalo de nuevo.";
  }
  if (
    detail.toLowerCase().includes("whatsapp credentials are missing") ||
    detail.includes("WHATSAPP_ACCESS_TOKEN") ||
    detail.includes("N8N_WHATSAPP_WEBHOOK_URL")
  ) {
    return "La conexión de WhatsApp todavía no tiene credenciales válidas en el servidor. Puedes abrir y enviar el mensaje manualmente mientras se completa la configuración de Meta u OpenWA.";
  }
  if (detail.toLowerCase().includes("whatsapp is not connected")) {
    return "Activa una conexión de WhatsApp antes de usar el envío automático. El envío manual sigue disponible.";
  }
  return detail || "No se pudo completar la operación";
}

async function throwFunctionError(error) {
  if (!error) return;
  try {
    const payload = await error.context?.json();
    throw new Error(
      normalizeCrmError(payload?.error || payload?.message || error.message)
    );
  } catch (contextError) {
    if (contextError instanceof Error && contextError.message !== error.message) {
      throw contextError;
    }
    throw new Error(normalizeCrmError(error.message));
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
    notificacionEnvios,
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
      .select("*, clientes_crm(nombres, apellidos, email, telefono), crm_planes(nombre, descripcion, precio, periodicidad, duracion_dias)")
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
    supabase
      .from("crm_notificacion_envios")
      .select("*, clientes_crm(nombres, apellidos, email, telefono)")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false })
      .limit(100),
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
    notificacionEnvios,
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
    notificacionEnvios: notificacionEnvios.data || [],
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
  const { id, id_empresa, ...values } = payload;
  const { data, error } = await supabase
    .from("clientes_crm")
    .update(values)
    .eq("id", id)
    .eq("id_empresa", id_empresa)
    .select()
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    throw new Error(
      "No se pudo actualizar el cliente. Recarga el directorio e inténtalo de nuevo."
    );
  }
  return data;
}

export async function EnviarInvitacionCliente({
  id_empresa,
  email,
  id_plan,
}) {
  if (!id_plan) {
    throw new Error("Selecciona el plan que tendrá el cliente");
  }
  const { data, error } = await supabase.functions.invoke("crm-send-invitation", {
    body: {
      id_empresa,
      email,
      id_plan: Number(id_plan),
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

export async function EditarCrmPlan({
  id,
  id_empresa,
  nombre,
  descripcion,
  precio,
  periodicidad,
  duracion_dias,
  activo,
}) {
  const { data, error } = await supabase
    .from("crm_planes")
    .update({
      ...(nombre !== undefined ? { nombre } : {}),
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(precio !== undefined ? { precio } : {}),
      ...(periodicidad !== undefined ? { periodicidad } : {}),
      ...(duracion_dias !== undefined ? { duracion_dias } : {}),
      ...(activo !== undefined ? { activo } : {}),
    })
    .eq("id", Number(id))
    .eq("id_empresa", Number(id_empresa))
    .select()
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("El plan no existe o ya no tienes acceso a él");
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

export async function EditarCrmHorario(payload) {
  const { id, id_empresa, ...values } = payload;
  const { data, error } = await supabase
    .from("crm_horarios")
    .update(values)
    .eq("id", Number(id))
    .eq("id_empresa", Number(id_empresa))
    .select()
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("El horario no existe o ya no tienes acceso a él");
  return data;
}

export async function EliminarCrmHorario({ id, id_empresa }) {
  const { error } = await supabase
    .from("crm_horarios")
    .delete()
    .eq("id", Number(id))
    .eq("id_empresa", Number(id_empresa));
  throwIfError(error);
}

export async function MostrarCrmHorariosPage({
  id_empresa,
  page = 1,
  pageSize = 5,
  search = "",
  status = "todos",
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(25, Math.max(5, Number(pageSize) || 5));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  let query = supabase
    .from("crm_horarios")
    .select("*", { count: "exact" })
    .eq("id_empresa", Number(id_empresa))
    .order("activo", { ascending: false })
    .order("hora_entrada", { ascending: true })
    .order("id", { ascending: false })
    .range(from, to);
  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) query = query.ilike("nombre", `%${normalizedSearch}%`);
  if (status === "activo") query = query.eq("activo", true);
  if (status === "inactivo") query = query.eq("activo", false);
  const { data, error, count } = await query;
  throwIfError(error);
  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  return {
    data: data || [],
    pagination: {
      page: Math.min(safePage, totalPages), pageSize: safePageSize, total, totalPages,
      from: total ? from + 1 : 0, to: Math.min(from + safePageSize, total),
      hasPreviousPage: safePage > 1, hasNextPage: safePage < totalPages,
    },
  };
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

export async function FacturarSuscripcionCliente(payload) {
  const { data, error } = await supabase.rpc("crm_facturar_suscripcion", {
    p_id_suscripcion: Number(payload.id_suscripcion),
    p_estado: payload.estado || "pagado",
    p_metodo_pago: payload.metodo_pago || null,
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function CobrarSuscripcionPos(payload) {
  const { data, error } = await supabase.rpc("crm_cobrar_suscripcion_pos", {
    p_id_suscripcion: Number(payload.id_suscripcion),
    p_metodo_pago: payload.metodo_pago || "efectivo",
    p_monto_recibido:
      payload.monto_recibido === "" || payload.monto_recibido === undefined
        ? null
        : Number(payload.monto_recibido),
    p_referencia_pago: payload.referencia_pago || null,
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function AbonarSuscripcionPos(payload) {
  const { data, error } = await supabase.rpc("crm_abonar_suscripcion_pos", {
    p_id_suscripcion: Number(payload.id_suscripcion),
    p_monto_abono: Number(payload.monto_abono),
    p_metodo_pago: payload.metodo_pago || "efectivo",
    p_monto_recibido:
      payload.monto_recibido === "" || payload.monto_recibido === undefined
        ? null
        : Number(payload.monto_recibido),
    p_referencia_pago: payload.referencia_pago || null,
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function RegistrarPagoPos(payload) {
  const { data, error } = await supabase.rpc("crm_registrar_pago_pos", {
    p_id_cliente_crm: Number(payload.id_cliente_crm),
    p_id_suscripcion: payload.id_suscripcion ? Number(payload.id_suscripcion) : null,
    p_monto: Number(payload.monto),
    p_metodo_pago: payload.metodo_pago || "efectivo",
    p_monto_recibido:
      payload.monto_recibido === "" || payload.monto_recibido === undefined
        ? null
        : Number(payload.monto_recibido),
    p_referencia_pago: payload.referencia_pago || null,
    p_fecha_vencimiento: payload.fecha_vencimiento || null,
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function RenovarSuscripcionPos(payload) {
  const { data, error } = await supabase.rpc("crm_renovar_suscripcion_pos", {
    p_id_suscripcion: Number(payload.id_suscripcion),
    p_metodo_pago: payload.metodo_pago || "efectivo",
    p_monto_recibido:
      payload.monto_recibido === "" || payload.monto_recibido === undefined
        ? null
        : Number(payload.monto_recibido),
    p_referencia_pago: payload.referencia_pago || null,
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function CobrarMoraPos(payload) {
  const { data, error } = await supabase.rpc("crm_cobrar_mora_pos", {
    p_id_cliente_crm: Number(payload.id_cliente_crm),
    p_metodo_pago: payload.metodo_pago || "efectivo",
    p_monto_recibido:
      payload.monto_recibido === "" || payload.monto_recibido === undefined
        ? null
        : Number(payload.monto_recibido),
    p_referencia_pago: payload.referencia_pago || null,
    p_notas: payload.notas || null,
  });
  throwIfError(error);
  return data;
}

export async function MostrarReporteIngresosMensual({ mes }) {
  const { data, error } = await supabase.rpc("crm_reporte_ingresos_mensuales", {
    p_mes: mes || new Date().toISOString().slice(0, 7) + "-01",
  });
  throwIfError(error);
  return data || [];
}

export async function MostrarCrmHistorialCobrosPage({
  id_empresa,
  page = 1,
  pageSize = 10,
  search = "",
  method = "todos",
  month = "",
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(5, Number(pageSize) || 10));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  let query = supabase
    .from("crm_historial_cobros")
    .select("*", { count: "exact" })
    .eq("id_empresa", id_empresa)
    .order("fecha_pago", { ascending: false })
    .order("id_origen", { ascending: false })
    .range(from, to);
  const normalizedSearch = String(search || "").trim().toLowerCase();
  if (normalizedSearch) query = query.ilike("busqueda", `%${normalizedSearch}%`);
  if (method !== "todos") query = query.ilike("metodo_pago", method);
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString();
    query = query.gte("fecha_pago", `${month}-01T00:00:00.000Z`).lt("fecha_pago", nextMonth);
  }
  const { data, error, count } = await query;
  throwIfError(error);
  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  return {
    data: data || [],
    pagination: {
      page: Math.min(safePage, totalPages), pageSize: safePageSize, total, totalPages,
      from: total ? from + 1 : 0, to: Math.min(from + safePageSize, total),
      hasPreviousPage: safePage > 1, hasNextPage: safePage < totalPages,
    },
  };
}

export async function EnviarComprobanteCobro({ id_empresa, comprobante_id }) {
  const { data, error } = await supabase.functions.invoke("crm-send-receipt", {
    body: {
      id_empresa: Number(id_empresa),
      comprobante_id: String(comprobante_id || "").trim(),
    },
  });
  await throwFunctionError(error);
  return data;
}

export async function MostrarCrmClientesPage({
  id_empresa,
  page = 1,
  pageSize = 10,
  search = "",
  clientStatus = "todos",
  financialStatus = "todos",
  planId = "todos",
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(5, Number(pageSize) || 10));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("crm_clientes_directorio")
    .select("*", { count: "exact" })
    .eq("id_empresa", id_empresa)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  const normalizedSearch = String(search || "").trim().toLowerCase();
  if (normalizedSearch) query = query.ilike("busqueda", `%${normalizedSearch}%`);
  if (clientStatus && clientStatus !== "todos") {
    query = query.eq("estado_cliente", clientStatus);
  }
  if (financialStatus && financialStatus !== "todos") {
    query = query.eq("estado_financiero", financialStatus);
  }
  if (planId && planId !== "todos") query = query.eq("id_plan", Number(planId));

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

export async function MostrarCrmInvitacionesPage({
  id_empresa,
  page = 1,
  pageSize = 5,
  search = "",
  status = "todos",
  deliveryStatus = "todos",
  planId = "todos",
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(5, Math.max(5, Number(pageSize) || 5));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  let query = supabase
    .from("crm_invitaciones")
    .select("id, email, estado, estado_envio, email_enviado_at, expires_at, ultimo_error_email, intentos_email, created_at, id_plan, crm_planes(nombre, precio, periodicidad)", { count: "exact" })
    .eq("id_empresa", id_empresa)
    .order("created_at", { ascending: false })
    .range(from, to);
  const normalizedSearch = String(search || "").trim().toLowerCase();
  if (normalizedSearch) query = query.ilike("email", `%${normalizedSearch}%`);
  if (status !== "todos") query = query.eq("estado", status);
  if (deliveryStatus !== "todos") query = query.eq("estado_envio", deliveryStatus);
  if (planId !== "todos") query = query.eq("id_plan", Number(planId));
  const { data, error, count } = await query;
  throwIfError(error);
  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  return {
    data: data || [],
    pagination: {
      page: Math.min(safePage, totalPages), pageSize: safePageSize, total, totalPages,
      from: total ? from + 1 : 0, to: Math.min(from + safePageSize, total),
      hasPreviousPage: safePage > 1, hasNextPage: safePage < totalPages,
    },
  };
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

export async function GestionarCrmSuscripcion({
  id,
  accion,
  id_plan = null,
  fecha = null,
}) {
  const { data, error } = await supabase.rpc("crm_gestionar_suscripcion", {
    p_id_suscripcion: Number(id),
    p_accion: accion,
    p_id_plan: id_plan ? Number(id_plan) : null,
    p_fecha: fecha || new Date().toISOString().slice(0, 10),
  });
  throwIfError(error);
  return data;
}

export async function EditarCrmSuscripcion({
  id,
  id_plan,
  fecha_inicio,
  fecha_fin,
}) {
  const { data, error } = await supabase.rpc("crm_editar_suscripcion", {
    p_id_suscripcion: Number(id),
    p_id_plan: Number(id_plan),
    p_fecha_inicio: fecha_inicio,
    p_fecha_fin: fecha_fin || null,
  });
  throwIfError(error);
  return data;
}

export async function MostrarCrmClientesAsistencia({
  id_empresa,
  search = "",
  limit = 8,
}) {
  let query = supabase
    .from("crm_clientes_asistencia")
    .select("*")
    .eq("id_empresa", id_empresa)
    .order("nombres", { ascending: true })
    .limit(Math.min(20, Math.max(1, Number(limit) || 8)));

  const value = String(search || "").trim().toLowerCase();
  if (value) {
    query = query.ilike("busqueda", `%${value}%`);
  }

  const { data, error } = await query;
  throwIfError(error);
  return data || [];
}

export async function AsignarCrmHorarioCliente({
  id_cliente_crm,
  id_horario,
}) {
  const { data, error } = await supabase.rpc("crm_asignar_horario_cliente", {
    p_id_cliente_crm: Number(id_cliente_crm),
    p_id_horario: id_horario ? Number(id_horario) : null,
  });
  throwIfError(error);
  return data;
}

export async function RegistrarCrmAsistencia({
  id_cliente_crm,
  estado,
  id_horario = null,
  notas = null,
}) {
  const { data, error } = await supabase.rpc("crm_registrar_asistencia", {
    p_id_cliente_crm: Number(id_cliente_crm),
    p_estado: estado,
    p_id_horario: id_horario ? Number(id_horario) : null,
    p_notas: notas || null,
  });
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
  await throwFunctionError(error);
  return data;
}

export async function MostrarInvitacionClienteActual({ invitationId = null } = {}) {
  const { data, error } = await supabase
    .rpc("crm_obtener_invitacion_actual", {
      p_invitacion_id: invitationId || null,
    })
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
