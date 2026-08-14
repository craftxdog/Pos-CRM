import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import {
  addIsoDays,
  buildNotificationContent,
  isoDateInTimeZone,
  normalizePhone,
  notificationDedupeKey,
} from "../_shared/crm-notifications.js";

const MAX_ATTEMPTS = 5;
const DEFAULT_MAX_PER_RUN = 200;
const DEFAULT_TIME_ZONE = "America/Managua";
const RECENT_EVENT_HOURS = 48;

type Automation = {
  id: number;
  id_empresa: number;
  evento: "cliente_creado" | "pago_vencido" | "factura_emitida" | "suscripcion_por_vencer";
  canal: "email" | "whatsapp";
  tipo_mensaje: "bienvenida" | "cobro" | "factura" | "suscripcion_por_vencer";
  dias_antes: number;
};

type Candidate = {
  client: Record<string, unknown>;
  payment?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
  plan?: Record<string, unknown>;
};

type DeliverySummary = {
  candidates: number;
  sent: number;
  queued: number;
  omitted: number;
  failed: number;
  skipped: number;
  previews: Array<Record<string, unknown>>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta configurar el secreto ${name}`);
  return value;
}

function envValue(primary: string, legacy?: string, alias?: string) {
  const value = Deno.env.get(primary)?.trim()
    || (alias ? Deno.env.get(alias)?.trim() : "")
    || (legacy ? Deno.env.get(legacy)?.trim() : "");
  if (!value) throw new Error(`Falta configurar el secreto ${primary}`);
  return value;
}

function serviceRoleKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const values = JSON.parse(requiredEnv("SUPABASE_SECRET_KEYS"));
  const key = values.default || Object.values(values)[0];
  if (!key) throw new Error("SUPABASE_SECRET_KEYS no contiene una clave utilizable");
  return String(key);
}

function smtpEnabled() {
  const value = Deno.env.get("SMTP_ENABLED")?.toLowerCase()
    || Deno.env.get("MAILERSEND_ENABLED")?.toLowerCase();
  return value === "true";
}

function smtpConfiguration() {
  const port = Number(envValue("SMTP_PORT", "MAILERSEND_SMTP_PORT"));
  if (![465, 587].includes(port)) throw new Error("SMTP_PORT debe ser 465 o 587");
  const host = envValue("SMTP_HOST", "MAILERSEND_SMTP_HOST");
  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user: envValue("SMTP_USER", "MAILERSEND_SMTP_USER"),
      pass: envValue("SMTP_PASSWORD", "MAILERSEND_SMTP_PASSWORD"),
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    requireTLS: port === 587,
    tls: { minVersion: "TLSv1.2", servername: host },
  };
}

function one(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) || null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function digitsOnly(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "Error desconocido")).slice(0, 500);
}

async function hmacHex(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyCronRequest(admin: SupabaseClient, request: Request) {
  const supplied = request.headers.get("X-CRM-Cron-Secret")?.trim() || "";
  if (!supplied) return false;
  const { data, error } = await admin.rpc("crm_verify_notification_cron_secret", {
    p_secret: supplied,
  });
  if (error) throw error;
  return data === true;
}

async function fetchCandidates(
  admin: SupabaseClient,
  automation: Automation,
  today: string,
  now: Date,
  limit: number,
): Promise<Candidate[]> {
  const clientFields = "id,nombres,apellidos,email,telefono,created_at,notificaciones_email,notificaciones_whatsapp";
  if (automation.evento === "suscripcion_por_vencer") {
    const { data, error } = await admin
      .from("crm_suscripciones")
      .select(`id,id_cliente_crm,id_plan,fecha_inicio,fecha_fin,precio_pactado,clientes_crm(${clientFields}),crm_planes(id,nombre,descripcion)`)
      .eq("id_empresa", automation.id_empresa)
      .eq("estado", "activa")
      .gte("fecha_fin", today)
      .lte("fecha_fin", addIsoDays(today, automation.dias_antes))
      .order("fecha_fin", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).flatMap((subscription) => {
      const client = one(subscription.clientes_crm);
      if (!client) return [];
      return [{
        client,
        subscription,
        plan: one(subscription.crm_planes) || undefined,
      }];
    });
  }

  if (automation.evento === "pago_vencido") {
    const { data, error } = await admin
      .from("crm_pagos")
      .select(`id,id_cliente_crm,id_suscripcion,monto,moneda,referencia,fecha_pago,fecha_vencimiento,created_at,clientes_crm(${clientFields}),crm_suscripciones(id,fecha_inicio,fecha_fin,crm_planes(id,nombre,descripcion))`)
      .eq("id_empresa", automation.id_empresa)
      .in("estado", ["pendiente", "vencido"])
      .not("fecha_vencimiento", "is", null)
      .lt("fecha_vencimiento", today)
      .order("fecha_vencimiento", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).flatMap((payment) => {
      const client = one(payment.clientes_crm);
      if (!client) return [];
      const subscription = one(payment.crm_suscripciones) || undefined;
      return [{
        client,
        payment,
        subscription,
        plan: one(subscription?.crm_planes) || undefined,
      }];
    });
  }

  if (automation.evento === "factura_emitida") {
    const recent = new Date(now.getTime() - RECENT_EVENT_HOURS * 3_600_000).toISOString();
    const { data, error } = await admin
      .from("crm_pagos")
      .select(`id,id_cliente_crm,id_suscripcion,monto,moneda,referencia,fecha_pago,fecha_vencimiento,created_at,clientes_crm(${clientFields}),crm_suscripciones(id,fecha_inicio,fecha_fin,crm_planes(id,nombre,descripcion))`)
      .eq("id_empresa", automation.id_empresa)
      .eq("estado", "pagado")
      .gte("fecha_pago", recent)
      .order("fecha_pago", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).flatMap((payment) => {
      const client = one(payment.clientes_crm);
      if (!client) return [];
      const subscription = one(payment.crm_suscripciones) || undefined;
      return [{
        client,
        payment,
        subscription,
        plan: one(subscription?.crm_planes) || undefined,
      }];
    });
  }

  const recent = new Date(now.getTime() - RECENT_EVENT_HOURS * 3_600_000).toISOString();
  const { data, error } = await admin
    .from("clientes_crm")
    .select(clientFields)
    .eq("id_empresa", automation.id_empresa)
    .gte("created_at", recent)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((client) => ({ client }));
}

async function ensureDeliveryRecord(
  admin: SupabaseClient,
  values: Record<string, unknown>,
) {
  const { data: existing, error: selectError } = await admin
    .from("crm_notificacion_envios")
    .select("*")
    .eq("id_empresa", values.id_empresa)
    .eq("canal", values.canal)
    .eq("dedupe_key", values.dedupe_key)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await admin
    .from("crm_notificacion_envios")
    .insert(values)
    .select("*")
    .maybeSingle();
  if (!error) return data;
  if (error.code === "23505") {
    const { data: raced, error: racedError } = await admin
      .from("crm_notificacion_envios")
      .select("*")
      .eq("id_empresa", values.id_empresa)
      .eq("canal", values.canal)
      .eq("dedupe_key", values.dedupe_key)
      .maybeSingle();
    if (racedError) throw racedError;
    return raced;
  }
  throw error;
}

async function ensureWhatsappMessage(
  admin: SupabaseClient,
  automation: Automation,
  candidate: Candidate,
  destination: string,
  content: Record<string, unknown>,
  template: Record<string, unknown> | null,
  dedupeKey: string,
) {
  const { data: existing, error: selectError } = await admin
    .from("crm_whatsapp_mensajes")
    .select("*")
    .eq("id_empresa", automation.id_empresa)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await admin
    .from("crm_whatsapp_mensajes")
    .insert({
      id_empresa: automation.id_empresa,
      id_cliente_crm: candidate.client.id,
      id_pago: candidate.payment?.id || null,
      id_suscripcion: candidate.subscription?.id || null,
      tipo: automation.tipo_mensaje,
      destino: destination,
      plantilla: template?.meta_template_name || template?.nombre || null,
      cuerpo: content.whatsapp,
      variables: content.variables,
      estado: "pendiente",
      scheduled_at: new Date().toISOString(),
      dedupe_key: dedupeKey,
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function sendEmail(
  transporter: nodemailer.Transporter,
  company: Record<string, unknown>,
  destination: string,
  content: Record<string, unknown>,
  dedupeKey: string,
) {
  const fromEmail = envValue("SMTP_FROM_EMAIL", "MAILERSEND_FROM_EMAIL", "FROM_EMAIL");
  const fromName = Deno.env.get("SMTP_FROM_NAME")?.trim()
    || Deno.env.get("MAILERSEND_FROM_NAME")?.trim()
    || Deno.env.get("FROM_NAME")?.trim()
    || String(company.nombre || "ActiveSelfControl");
  const replyTo = Deno.env.get("SMTP_REPLY_TO_EMAIL")?.trim()
    || Deno.env.get("REPLY_TO_EMAIL")?.trim()
    || undefined;
  const result = await transporter.sendMail({
    from: { name: fromName, address: fromEmail },
    to: destination,
    replyTo,
    subject: content.subject,
    text: content.text,
    html: content.html,
    headers: { "X-ASC-Notification-Key": dedupeKey },
  });
  return { provider: "smtp", providerMessageId: result.messageId || null };
}

async function sendWhatsapp(
  admin: SupabaseClient,
  automation: Automation,
  candidate: Candidate,
  config: Record<string, unknown>,
  template: Record<string, unknown> | null,
  destination: string,
  content: Record<string, unknown>,
  dedupeKey: string,
) {
  const message = await ensureWhatsappMessage(
    admin,
    automation,
    candidate,
    destination,
    content,
    template,
    dedupeKey,
  );
  if (message.estado === "enviado") {
    return { provider: config.proveedor, providerMessageId: message.provider_message_id, alreadySent: true };
  }
  if (config.estado !== "conectado") {
    throw new Error("WhatsApp no está conectado para esta empresa");
  }
  if (config.proveedor === "manual") {
    return { provider: "manual", providerMessageId: null, queued: true };
  }

  try {
    let providerResult: Record<string, unknown>;
    if (config.proveedor === "openwa_n8n") {
      const webhookUrl = requiredEnv("N8N_WHATSAPP_WEBHOOK_URL");
      const webhookSecret = requiredEnv("N8N_WHATSAPP_WEBHOOK_SECRET");
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({
        event: "crm.whatsapp.dispatch",
        message_id: message.public_id || message.id,
        legacy_message_id: message.id,
        company_id: automation.id_empresa,
        session_id: (config.metadata as Record<string, unknown>)?.openwa_session_id || "default",
        to: `${digitsOnly(destination)}@c.us`,
        text: content.whatsapp,
        template: message.plantilla,
        mode: "text",
      });
      const signature = await hmacHex(`${timestamp}.${payload}`, webhookSecret);
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ASC-Timestamp": timestamp,
          "X-ASC-Signature": `sha256=${signature}`,
        },
        body: payload,
      });
      const responseText = await response.text();
      try {
        providerResult = responseText ? JSON.parse(responseText) : {};
      } catch {
        providerResult = { response: responseText };
      }
      if (!response.ok) throw new Error(`n8n/OpenWA rechazó el mensaje: ${JSON.stringify(providerResult)}`);
    } else if (config.proveedor === "meta_cloud") {
      const token = requiredEnv("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = String(config.phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "");
      const graphVersion = requiredEnv("WHATSAPP_GRAPH_API_VERSION");
      if (!phoneNumberId) throw new Error("Falta configurar WHATSAPP_PHONE_NUMBER_ID");
      if (!template?.meta_template_name) {
        throw new Error(`Falta una plantilla aprobada de Meta para ${automation.tipo_mensaje}`);
      }
      const variableNames = Array.isArray(template.variables) ? template.variables : [];
      const variables = content.variables as Record<string, unknown>;
      const parameters = variableNames.map((name) => ({
        type: "text",
        text: String(variables[String(name)] || ""),
      }));
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digitsOnly(destination),
        type: "template",
        template: {
          name: template.meta_template_name,
          language: { code: template.idioma || config.default_language || "es" },
          ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}),
        },
      };
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      providerResult = await response.json();
      if (!response.ok) throw new Error(`Meta rechazó el mensaje: ${JSON.stringify(providerResult)}`);
    } else {
      throw new Error(`Proveedor de WhatsApp no soportado: ${config.proveedor}`);
    }

    const providerMessageId = String(
      (providerResult.messages as Array<Record<string, unknown>>)?.[0]?.id
      || providerResult.message_id
      || providerResult.id
      || "",
    ) || null;
    const sentAt = new Date().toISOString();
    const { error } = await admin
      .from("crm_whatsapp_mensajes")
      .update({ estado: "enviado", sent_at: sentAt, provider_message_id: providerMessageId, error: null })
      .eq("id", message.id);
    if (error) throw error;
    return { provider: config.proveedor, providerMessageId };
  } catch (error) {
    await admin
      .from("crm_whatsapp_mensajes")
      .update({ estado: "error", error: errorMessage(error) })
      .eq("id", message.id);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const now = new Date();
  const summary: DeliverySummary = {
    candidates: 0,
    sent: 0,
    queued: 0,
    omitted: 0,
    failed: 0,
    skipped: 0,
    previews: [],
  };
  let transporter: nodemailer.Transporter | null = null;

  try {
    const admin = createClient(requiredEnv("SUPABASE_URL"), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (!await verifyCronRequest(admin, request)) {
      return jsonResponse({ error: "Solicitud de automatización no autorizada" }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const companyId = Number(body.company_id || 0);
    const requestedMax = Number(Deno.env.get("CRM_NOTIFICATIONS_MAX_PER_RUN") || DEFAULT_MAX_PER_RUN);
    const maxPerRun = Math.min(1000, Math.max(1, Number.isFinite(requestedMax) ? requestedMax : DEFAULT_MAX_PER_RUN));
    const timeZone = Deno.env.get("CRM_NOTIFICATIONS_TIME_ZONE") || DEFAULT_TIME_ZONE;
    const today = isoDateInTimeZone(now, timeZone);
    const replyTo = Deno.env.get("SMTP_REPLY_TO_EMAIL")?.trim()
      || Deno.env.get("REPLY_TO_EMAIL")?.trim()
      || "";

    let automationQuery = admin
      .from("crm_automatizaciones")
      .select("id,id_empresa,evento,canal,tipo_mensaje,dias_antes")
      .eq("activo", true)
      .order("id_empresa", { ascending: true })
      .order("evento", { ascending: true })
      .order("canal", { ascending: true });
    if (Number.isSafeInteger(companyId) && companyId > 0) {
      automationQuery = automationQuery.eq("id_empresa", companyId);
    }
    const { data: automations, error: automationError } = await automationQuery;
    if (automationError) throw automationError;
    const companyIds = [...new Set((automations || []).map((item) => Number(item.id_empresa)))];
    if (!companyIds.length) return jsonResponse({ ok: true, dry_run: dryRun, today, ...summary });

    const [companiesResult, configsResult, templatesResult] = await Promise.all([
      admin.from("empresa").select("id,nombre,currency").in("id", companyIds),
      admin.from("crm_whatsapp_config").select("*").in("id_empresa", companyIds),
      admin.from("crm_whatsapp_plantillas").select("*").in("id_empresa", companyIds).eq("activo", true),
    ]);
    if (companiesResult.error) throw companiesResult.error;
    if (configsResult.error) throw configsResult.error;
    if (templatesResult.error) throw templatesResult.error;

    const companies = new Map((companiesResult.data || []).map((item) => [Number(item.id), item]));
    const configs = new Map((configsResult.data || []).map((item) => [Number(item.id_empresa), item]));
    const templates = new Map((templatesResult.data || []).map((item) => [`${item.id_empresa}:${item.tipo}`, item]));
    const candidateCache = new Map<string, Promise<Candidate[]>>();

    for (const rawAutomation of automations || []) {
      if (summary.candidates >= maxPerRun) break;
      const automation = rawAutomation as Automation;
      const company = companies.get(Number(automation.id_empresa));
      if (!company) continue;
      const cacheKey = `${automation.id_empresa}:${automation.evento}:${automation.dias_antes}`;
      if (!candidateCache.has(cacheKey)) {
        candidateCache.set(
          cacheKey,
          fetchCandidates(admin, automation, today, now, maxPerRun),
        );
      }
      const candidates = await candidateCache.get(cacheKey)!;
      for (const candidate of candidates) {
        if (summary.candidates >= maxPerRun) break;
        summary.candidates += 1;
        const client = candidate.client;
        const preference = automation.canal === "email"
          ? client.notificaciones_email !== false
          : client.notificaciones_whatsapp !== false;
        const config = configs.get(Number(automation.id_empresa)) || null;
        const destination = automation.canal === "email"
          ? String(client.email || "").trim().toLowerCase()
          : normalizePhone(client.telefono, config?.default_country_code || "505");
        const template = templates.get(`${automation.id_empresa}:${automation.tipo_mensaje}`) || null;
        const content = buildNotificationContent({
          event: automation.evento,
          candidate,
          company,
          today,
          whatsappTemplate: template?.cuerpo || "",
          replyTo,
        });
        const dedupeKey = notificationDedupeKey(automation.evento, candidate);

        if (dryRun) {
          if (summary.previews.length < 25) {
            summary.previews.push({
              company_id: automation.id_empresa,
              event: automation.evento,
              channel: automation.canal,
              destination: destination || null,
              preference,
              dedupe_key: dedupeKey,
            });
          }
          continue;
        }

        const baseRecord = {
          id_empresa: automation.id_empresa,
          id_cliente_crm: client.id,
          id_pago: candidate.payment?.id || null,
          id_suscripcion: candidate.subscription?.id || null,
          evento: automation.evento,
          canal: automation.canal,
          destino: destination || (automation.canal === "email" ? "(sin correo)" : "(sin teléfono)"),
          asunto: automation.canal === "email" ? content.subject : null,
          cuerpo: automation.canal === "email" ? content.text : content.whatsapp,
          dedupe_key: dedupeKey,
          estado: "pendiente",
          detalles: { automation_id: automation.id, tipo_mensaje: automation.tipo_mensaje },
        };
        const delivery = await ensureDeliveryRecord(admin, baseRecord);
        if (!delivery) throw new Error("No se pudo crear el registro de entrega");
        if (["enviado", "omitido"].includes(delivery.estado)) {
          summary.skipped += 1;
          continue;
        }
        if (Number(delivery.intentos || 0) >= MAX_ATTEMPTS) {
          summary.skipped += 1;
          continue;
        }
        if (!preference) {
          await admin.from("crm_notificacion_envios").update({
            estado: "omitido",
            error: "El cliente desactivó este canal",
          }).eq("id", delivery.id);
          summary.omitted += 1;
          continue;
        }

        const attempts = Number(delivery.intentos || 0) + 1;
        const attemptedAt = new Date().toISOString();
        await admin.from("crm_notificacion_envios").update({
          estado: "pendiente",
          intentos: attempts,
          last_attempt_at: attemptedAt,
          error: null,
          destino: baseRecord.destino,
        }).eq("id", delivery.id);

        try {
          if (!destination) throw new Error(`El cliente no tiene ${automation.canal === "email" ? "correo" : "teléfono"} válido`);
          let providerResult: Record<string, unknown>;
          if (automation.canal === "email") {
            if (!smtpEnabled()) throw new Error("El envío SMTP está deshabilitado");
            if (!transporter) {
              transporter = nodemailer.createTransport(smtpConfiguration());
              await transporter.verify();
            }
            providerResult = await sendEmail(transporter, company, destination, content, dedupeKey);
          } else {
            if (!config) throw new Error("WhatsApp no está configurado para esta empresa");
            providerResult = await sendWhatsapp(
              admin,
              automation,
              candidate,
              config,
              template,
              destination,
              content,
              dedupeKey,
            );
          }

          if (providerResult.queued === true) {
            summary.queued += 1;
            continue;
          }
          const sentAt = new Date().toISOString();
          const { error: updateError } = await admin.from("crm_notificacion_envios").update({
            estado: "enviado",
            sent_at: sentAt,
            provider_message_id: providerResult.providerMessageId || null,
            error: null,
            detalles: {
              ...baseRecord.detalles,
              provider: providerResult.provider,
            },
          }).eq("id", delivery.id);
          if (updateError) throw updateError;
          summary.sent += 1;
        } catch (error) {
          const message = errorMessage(error);
          console.error("crm-notifications-run:", automation.id_empresa, automation.evento, automation.canal, message);
          await admin.from("crm_notificacion_envios").update({
            estado: "error",
            error: message,
          }).eq("id", delivery.id);
          summary.failed += 1;
        }
      }
    }

    return jsonResponse({ ok: summary.failed === 0, dry_run: dryRun, today, ...summary });
  } catch (error) {
    console.error("crm-notifications-run fatal:", errorMessage(error));
    return jsonResponse({ error: errorMessage(error), ...summary }, 500);
  } finally {
    transporter?.close();
  }
});
