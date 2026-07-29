import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";
// @ts-types="npm:@types/nunjucks@3.2.6"
import nunjucks from "nunjucks";

const ADMIN_ROLES = new Set(["superadmin", "administrador", "admin"]);
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
const htmlTemplate = await Deno.readTextFile(new URL("./templates/receipt.html.njk", import.meta.url));
const textTemplate = await Deno.readTextFile(new URL("./templates/receipt.txt.njk", import.meta.url));

function envValue(primary: string, legacy?: string, alias?: string) {
  const value = Deno.env.get(primary)?.trim()
    || (alias ? Deno.env.get(alias)?.trim() : "")
    || (legacy ? Deno.env.get(legacy)?.trim() : "");
  if (!value) throw new Error(`Falta configurar el secreto ${primary}`);
  return value;
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

function money(value: unknown, currency: string) {
  try {
    return new Intl.NumberFormat("es-NI", { style: "currency", currency: currency || "USD" }).format(Number(value || 0));
  } catch {
    return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function publicErrorMessage(message: string) {
  if (/connection closed|socket closed|econnreset|etimedout|econnrefused|network request failed/i.test(message)) {
    return "No se pudo conectar al SMTP configurado. Revisa Hostinger e inténtalo de nuevo.";
  }
  return message;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    if (request.method !== "POST") return Response.json({ error: "Método no permitido" }, { status: 405 });

    let companyId: number | null = null;
    let receiptId = "";
    let recipient = "";
    let callerId: number | null = null;
    try {
      if (Deno.env.get("SMTP_ENABLED")?.toLowerCase() !== "true") {
        throw new Error("El envío de correo está deshabilitado");
      }
      const body = await request.json();
      companyId = Number(body.id_empresa);
      receiptId = String(body.comprobante_id || "").trim();
      if (!Number.isSafeInteger(companyId) || companyId <= 0 || !/^[PR]-\d+$/.test(receiptId)) {
        throw new Error("El comprobante solicitado no es válido");
      }

      const authId = ctx.userClaims?.id || ctx.jwtClaims?.sub;
      if (!authId) throw new Error("No se pudo identificar al usuario");
      const { data: caller, error: callerError } = await ctx.supabaseAdmin
        .from("usuarios")
        .select("id, id_empresa, roles(nombre)")
        .eq("id_auth", authId)
        .maybeSingle();
      if (callerError || !caller || Number(caller.id_empresa) !== companyId) {
        throw new Error("No tienes acceso a esta empresa");
      }
      if (!ADMIN_ROLES.has(String(caller.roles?.nombre || "").toLowerCase())) {
        throw new Error("No tienes permiso para enviar comprobantes");
      }
      callerId = Number(caller.id);

      const [{ data: company, error: companyError }, { data: receipt, error: receiptError }] = await Promise.all([
        ctx.supabaseAdmin.from("empresa").select("nombre, currency").eq("id", companyId).maybeSingle(),
        ctx.supabaseAdmin.from("crm_historial_cobros").select("*").eq("id_empresa", companyId).eq("id", receiptId).maybeSingle(),
      ]);
      if (companyError || !company) throw new Error("No se encontró la empresa");
      if (receiptError || !receipt) throw new Error("No se encontró el comprobante");
      recipient = String(receipt.cliente_email || "").trim().toLowerCase();
      if (!recipient) throw new Error("Este cliente no tiene correo para recibir el comprobante");

      const fromEmail = envValue("SMTP_FROM_EMAIL", "MAILERSEND_FROM_EMAIL", "FROM_EMAIL");
      const fromName = Deno.env.get("SMTP_FROM_NAME")?.trim() || Deno.env.get("FROM_NAME")?.trim() || company.nombre;
      const replyTo = Deno.env.get("SMTP_REPLY_TO_EMAIL")?.trim() || Deno.env.get("REPLY_TO_EMAIL")?.trim() || undefined;
      const total = Number(receipt.monto || 0);
      const received = Number(receipt.monto_recibido ?? total);
      const change = Number(receipt.cambio || 0);
      const hasPlanAccount = Boolean(receipt.aplica_a_saldo_plan);
      const planTotal = Number(receipt.total_plan || 0);
      const cumulativePaid = Number(receipt.abonado_acumulado || 0);
      const remainingBalance = Number(receipt.saldo_pendiente || 0);
      const templateContext = {
        companyName: company.nombre,
        receiptReference: receipt.referencia || receiptId,
        customerName: [receipt.cliente_nombres, receipt.cliente_apellidos].filter(Boolean).join(" ") || "Cliente",
        receiptDate: dateTime(receipt.fecha_pago),
        planName: receipt.plan_nombre || "Cobro general",
        description: receipt.plan_descripcion || receipt.notas || "Pago registrado",
        paymentMethod: receipt.metodo_pago || "—",
        paymentReference: receipt.referencia_pago || "—",
        total: money(total, receipt.moneda || company.currency || "USD"),
        received: money(received, receipt.moneda || company.currency || "USD"),
        change: money(change, receipt.moneda || company.currency || "USD"),
        showCashBreakdown: received !== total || change > 0,
        hasPlanAccount,
        planTotal: money(planTotal, receipt.moneda || company.currency || "USD"),
        cumulativePaid: money(cumulativePaid, receipt.moneda || company.currency || "USD"),
        remainingBalance: money(remainingBalance, receipt.moneda || company.currency || "USD"),
        hasRemainingBalance: hasPlanAccount && remainingBalance > 0,
        period: receipt.periodo_inicio && receipt.periodo_fin ? `${receipt.periodo_inicio} – ${receipt.periodo_fin}` : "",
        replyTo: replyTo || "",
        currentYear: new Date().getUTCFullYear(),
      };

      const transporter = nodemailer.createTransport(smtpConfiguration());
      try {
        await transporter.verify();
        await transporter.sendMail({
          from: { name: fromName, address: fromEmail },
          to: recipient,
          replyTo,
          subject: templateContext.hasRemainingBalance
            ? `${company.nombre} · abono recibido y saldo pendiente`
            : `${company.nombre} · comprobante ${templateContext.receiptReference}`,
          text: textEnvironment.renderString(textTemplate, templateContext),
          html: htmlEnvironment.renderString(htmlTemplate, templateContext),
        });
      } finally {
        transporter.close();
      }

      const { error: auditError } = await ctx.supabaseAdmin.from("crm_comprobante_email_envios").insert({
        id_empresa: companyId,
        comprobante_id: receiptId,
        correo_destino: recipient,
        enviado_por: callerId,
        estado: "enviado",
      });
      if (auditError) throw auditError;
      return Response.json({ receipt_id: receiptId, recipient, status: "enviado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el comprobante";
      console.error("crm-send-receipt:", message);
      if (companyId && receiptId && recipient) {
        await ctx.supabaseAdmin.from("crm_comprobante_email_envios").insert({
          id_empresa: companyId,
          comprobante_id: receiptId,
          correo_destino: recipient,
          enviado_por: callerId,
          estado: "error",
          detalle_error: message.slice(0, 500),
        });
      }
      return Response.json({ error: publicErrorMessage(message) }, { status: 400 });
    }
  }),
};
