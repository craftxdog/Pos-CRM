import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";
// @ts-types="npm:@types/nunjucks@3.2.6"
import nunjucks from "nunjucks";

const ADMIN_ROLES = new Set(["superadmin", "administrador", "admin"]);
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const htmlEnvironment = new nunjucks.Environment(null, {
  autoescape: true,
  throwOnUndefined: true,
  trimBlocks: true,
  lstripBlocks: true,
});
const textEnvironment = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: true,
  trimBlocks: true,
  lstripBlocks: true,
});
const invitationHtmlTemplate = await Deno.readTextFile(
  new URL("./templates/invitation.html.njk", import.meta.url)
);
const invitationTextTemplate = await Deno.readTextFile(
  new URL("./templates/invitation.txt.njk", import.meta.url)
);

function envValue(primary: string, legacy?: string, alias?: string) {
  const value = Deno.env.get(primary)?.trim()
    || (alias ? Deno.env.get(alias)?.trim() : "")
    || (legacy ? Deno.env.get(legacy)?.trim() : "");
  if (!value) {
    throw new Error(`Falta configurar el secreto ${primary}`);
  }
  return value;
}

function smtpConfiguration() {
  const port = Number(envValue("SMTP_PORT", "MAILERSEND_SMTP_PORT"));
  if (![465, 587].includes(port)) {
    throw new Error("SMTP_PORT debe ser 465 (SSL implícito) o 587 (STARTTLS)");
  }
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

function publicErrorMessage(message: string) {
  if (
    message.includes("MS42225") ||
    message.toLowerCase().includes("trial account unique recipients limit")
  ) {
    return "El proveedor de correo alcanzó el límite de destinatarios únicos de la cuenta de prueba. Verifica el dominio o actualiza el plan antes de invitar nuevos correos.";
  }
  if (
    /connection closed|socket closed|econnreset|etimedout|econnrefused|network request failed/i.test(message)
  ) {
    return "No se pudo conectar al SMTP configurado. Revisa el host, puerto, cifrado (465 SSL o 587 STARTTLS) y las credenciales de Hostinger.";
  }
  return message;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Método no permitido" }, { status: 405 });
    }

    let invitationId: string | null = null;
    let attempts = 0;

    try {
      const emailEnabled = Deno.env.get("SMTP_ENABLED")?.toLowerCase()
        || Deno.env.get("MAILERSEND_ENABLED")?.toLowerCase();
      if (emailEnabled !== "true") {
        throw new Error("El envío de correo está deshabilitado");
      }

      const body = await request.json();
      const email = String(body.email || "").trim().toLowerCase();
      const companyId = Number(body.id_empresa);
      const planId = Number(body.id_plan);

      if (!EMAIL_PATTERN.test(email)) {
        throw new Error("Ingresa un correo válido");
      }
      if (!Number.isSafeInteger(companyId) || companyId <= 0) {
        throw new Error("La empresa no es válida");
      }
      if (!Number.isSafeInteger(planId) || planId <= 0) {
        throw new Error("Selecciona el plan que tendrá el cliente");
      }

      const callerAuthId = ctx.userClaims?.id || ctx.jwtClaims?.sub;
      if (!callerAuthId) {
        throw new Error("No se pudo identificar al usuario");
      }

      const { data: caller, error: callerError } = await ctx.supabaseAdmin
        .from("usuarios")
        .select("id, id_empresa, roles(nombre)")
        .eq("id_auth", callerAuthId)
        .maybeSingle();

      if (callerError || !caller || Number(caller.id_empresa) !== companyId) {
        throw new Error("No tienes acceso a esta empresa");
      }

      const role = String(caller.roles?.nombre || "").toLowerCase();
      if (!ADMIN_ROLES.has(role)) {
        throw new Error("No tienes permiso para enviar invitaciones");
      }

      const [{ data: company, error: companyError }, { data: plan, error: planError }] =
        await Promise.all([
          ctx.supabaseAdmin
            .from("empresa")
            .select("nombre, currency")
            .eq("id", companyId)
            .maybeSingle(),
          ctx.supabaseAdmin
            .from("crm_planes")
            .select("id, nombre, descripcion, precio, periodicidad, duracion_dias")
            .eq("id", planId)
            .eq("id_empresa", companyId)
            .eq("activo", true)
            .maybeSingle(),
        ]);

      if (companyError || !company) {
        throw new Error("No se encontró la empresa");
      }
      if (planError || !plan) {
        throw new Error("El plan seleccionado no existe o está inactivo");
      }

      const configuredSiteUrl = Deno.env.get("APP_SITE_URL")?.trim();
      const requestOrigin = request.headers.get("origin")?.trim();
      const siteUrl = configuredSiteUrl || requestOrigin;
      if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) {
        throw new Error("Falta configurar APP_SITE_URL");
      }
      const redirectTo = new URL("/onboarding-cliente", siteUrl).toString();

      const { data: linkData, error: linkError } =
        await ctx.supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });

      if (linkError || !linkData?.properties?.action_link) {
        throw new Error(linkError?.message || "No se pudo crear el enlace de acceso");
      }

      const { data: existing, error: existingError } = await ctx.supabaseAdmin
        .from("crm_invitaciones")
        .select("id, intentos_email")
        .eq("id_empresa", companyId)
        .ilike("email", email)
        .eq("estado", "pendiente")
        .maybeSingle();

      if (existingError) throw existingError;

      const invitationValues = {
        id_empresa: companyId,
        email,
        id_plan: planId,
        invited_by: caller.id,
        token_hash: await crypto.subtle
          .digest("SHA-256", new TextEncoder().encode(crypto.randomUUID()))
          .then((digest) =>
            Array.from(new Uint8Array(digest))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("")
          ),
        estado: "pendiente",
        estado_envio: "enviando",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ultimo_error_email: null,
      };

      const invitationQuery = existing
        ? ctx.supabaseAdmin
            .from("crm_invitaciones")
            .update(invitationValues)
            .eq("id", existing.id)
        : ctx.supabaseAdmin.from("crm_invitaciones").insert(invitationValues);

      const { data: invitation, error: invitationError } = await invitationQuery
        .select("id, intentos_email")
        .maybeSingle();

      if (invitationError || !invitation) {
        throw new Error(invitationError?.message || "No se pudo guardar la invitación");
      }

      invitationId = invitation.id;
      attempts = Number(invitation.intentos_email || existing?.intentos_email || 0) + 1;

      const transporter = nodemailer.createTransport(smtpConfiguration());
      const fromEmail = envValue("SMTP_FROM_EMAIL", "MAILERSEND_FROM_EMAIL", "FROM_EMAIL");
      const fromName = Deno.env.get("SMTP_FROM_NAME")?.trim()
        || Deno.env.get("FROM_NAME")?.trim()
        || Deno.env.get("MAILERSEND_FROM_NAME")?.trim()
        || company.nombre;
      const replyTo = Deno.env.get("SMTP_REPLY_TO_EMAIL")?.trim()
        || Deno.env.get("REPLY_TO_EMAIL")?.trim()
        || Deno.env.get("MAILERSEND_REPLY_TO_EMAIL")?.trim()
        || null;
      const templateContext = {
        companyName: company.nombre,
        planName: plan.nombre,
        planDescription: plan.descripcion || "",
        planPrice: new Intl.NumberFormat("es-NI", {
          style: "currency",
          currency: company.currency || "USD",
        }).format(Number(plan.precio || 0)),
        planDuration: plan.duracion_dias,
        planPeriodicity: plan.periodicidad,
        actionLink: linkData.properties.action_link,
        replyTo: replyTo || "",
        expiresDays: 7,
        currentYear: new Date().getUTCFullYear(),
      };

      try {
        await transporter.verify();
        await transporter.sendMail({
          from: { name: fromName, address: fromEmail },
          to: email,
          replyTo: replyTo || undefined,
          subject: `${company.nombre} te invita a completar tu registro`,
          text: textEnvironment.renderString(
            invitationTextTemplate,
            templateContext
          ),
          html: htmlEnvironment.renderString(
            invitationHtmlTemplate,
            templateContext
          ),
        });
      } finally {
        transporter.close();
      }

      const { error: trackingError } = await ctx.supabaseAdmin
        .from("crm_invitaciones")
        .update({
          email_enviado_at: new Date().toISOString(),
          estado_envio: "enviado",
          ultimo_error_email: null,
          intentos_email: attempts,
        })
        .eq("id", invitation.id);

      if (trackingError) throw trackingError;

      return Response.json({
        invitation: {
          id: invitation.id,
          email,
          email_enviado_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar la invitación";
      const clientMessage = publicErrorMessage(message);
      console.error("crm-send-invitation:", message);

      if (invitationId) {
        try {
          await ctx.supabaseAdmin
            .from("crm_invitaciones")
            .update({
              ultimo_error_email: message.slice(0, 500),
              estado_envio: "error",
              intentos_email: attempts || 1,
            })
            .eq("id", invitationId);
        } catch (trackingError) {
          console.error("crm-send-invitation tracking:", trackingError);
        }
      }

      return Response.json({ error: clientMessage }, { status: 400 });
    }
  }),
};
