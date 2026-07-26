import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

const ADMIN_ROLES = new Set(["superadmin", "administrador", "admin"]);
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Falta configurar el secreto ${name}`);
  }
  return value;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invitationHtml({
  companyName,
  planName,
  actionLink,
  replyTo,
}: {
  companyName: string;
  planName: string | null;
  actionLink: string;
  replyTo: string | null;
}) {
  const safeCompany = escapeHtml(companyName);
  const planCopy = planName
    ? `<p style="margin:0 0 20px;color:#475569">Plan seleccionado: <strong>${escapeHtml(planName)}</strong></p>`
    : "";
  const supportCopy = replyTo
    ? `<p style="margin:18px 0 0;color:#64748b;font-size:13px">¿Necesitas ayuda? Responde este correo o escribe a ${escapeHtml(replyTo)}.</p>`
    : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
            <tr><td style="height:8px;background:#f3d20c"></td></tr>
            <tr>
              <td style="padding:34px">
                <p style="margin:0 0 8px;color:#8a7600;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.08em">${safeCompany}</p>
                <h1 style="margin:0 0 14px;font-size:26px">Completa tu registro</h1>
                <p style="margin:0 0 20px;color:#475569;line-height:1.6">Has recibido una invitación para registrar tus datos como cliente. El proceso toma menos de un minuto.</p>
                ${planCopy}
                <a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#f3d20c;color:#111827;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:10px">Aceptar invitación</a>
                <p style="margin:22px 0 0;color:#64748b;font-size:13px;line-height:1.5">Este enlace es personal y de un solo uso. Si no esperabas esta invitación, puedes ignorar el mensaje.</p>
                ${supportCopy}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Método no permitido" }, { status: 405 });
    }

    let invitationId: string | null = null;
    let attempts = 0;

    try {
      if (Deno.env.get("MAILERSEND_ENABLED")?.toLowerCase() !== "true") {
        throw new Error("El envío de correo está deshabilitado");
      }

      const body = await request.json();
      const email = String(body.email || "").trim().toLowerCase();
      const companyId = Number(body.id_empresa);
      const planId = body.id_plan ? Number(body.id_plan) : null;

      if (!EMAIL_PATTERN.test(email)) {
        throw new Error("Ingresa un correo válido");
      }
      if (!Number.isSafeInteger(companyId) || companyId <= 0) {
        throw new Error("La empresa no es válida");
      }
      if (planId !== null && (!Number.isSafeInteger(planId) || planId <= 0)) {
        throw new Error("El plan no es válido");
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
            .select("nombre")
            .eq("id", companyId)
            .maybeSingle(),
          planId
            ? ctx.supabaseAdmin
                .from("crm_planes")
                .select("id, nombre")
                .eq("id", planId)
                .eq("id_empresa", companyId)
                .eq("activo", true)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

      if (companyError || !company) {
        throw new Error("No se encontró la empresa");
      }
      if (planError || (planId && !plan)) {
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

      const smtpPort = Number(requiredEnv("MAILERSEND_SMTP_PORT"));
      const transporter = nodemailer.createTransport({
        host: requiredEnv("MAILERSEND_SMTP_HOST"),
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: requiredEnv("MAILERSEND_SMTP_USER"),
          pass: requiredEnv("MAILERSEND_SMTP_PASSWORD"),
        },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
        tls: { minVersion: "TLSv1.2" },
      });

      const fromEmail = requiredEnv("MAILERSEND_FROM_EMAIL");
      const fromName = Deno.env.get("MAILERSEND_FROM_NAME")?.trim() || company.nombre;
      const replyTo = Deno.env.get("MAILERSEND_REPLY_TO_EMAIL")?.trim() || null;

      await transporter.sendMail({
        from: { name: fromName, address: fromEmail },
        to: email,
        replyTo: replyTo || undefined,
        subject: `${company.nombre} te invita a completar tu registro`,
        text: `Has recibido una invitación de ${company.nombre}. Completa tu registro aquí: ${linkData.properties.action_link}`,
        html: invitationHtml({
          companyName: company.nombre,
          planName: plan?.nombre || null,
          actionLink: linkData.properties.action_link,
          replyTo,
        }),
      });

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
      console.error("crm-send-invitation:", message);

      if (invitationId) {
        await ctx.supabaseAdmin
          .from("crm_invitaciones")
          .update({
            ultimo_error_email: message.slice(0, 500),
            estado_envio: "error",
            intentos_email: attempts || 1,
          })
          .eq("id", invitationId);
      }

      return Response.json({ error: message }, { status: 400 });
    }
  }),
};
