const EVENT_TYPES = new Set([
  "cliente_creado",
  "pago_vencido",
  "factura_emitida",
  "suscripcion_por_vencer",
]);

export function isoDateInTimeZone(value = new Date(), timeZone = "America/Managua") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function addIsoDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function daysBetweenIsoDates(from, to) {
  const start = new Date(`${from}T12:00:00.000Z`).getTime();
  const end = new Date(`${to}T12:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function normalizePhone(value, defaultCountryCode = "505") {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  const countryCode = String(defaultCountryCode || "505").replace(/\D/g, "") || "505";
  return digits.startsWith(countryCode) ? `+${digits}` : `+${countryCode}${digits}`;
}

export function renderVariables(template, variables) {
  return String(template || "").replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function notificationDedupeKey(event, candidate) {
  if (!EVENT_TYPES.has(event)) throw new Error(`Evento de notificación no soportado: ${event}`);
  if (event === "cliente_creado") {
    return `${event}:${candidate.client.id}:${String(candidate.client.created_at).slice(0, 10)}`;
  }
  if (event === "suscripcion_por_vencer") {
    return `${event}:${candidate.subscription.id}:${candidate.subscription.fecha_fin}`;
  }
  const timestamp = event === "pago_vencido"
    ? candidate.payment.fecha_vencimiento
    : candidate.payment.fecha_pago || candidate.payment.created_at;
  return `${event}:${candidate.payment.id}:${String(timestamp).slice(0, 10)}`;
}

function fullName(client) {
  return [client?.nombres, client?.apellidos].filter(Boolean).join(" ").trim() || "Cliente";
}

function money(value, currency = "NIO") {
  try {
    return new Intl.NumberFormat("es-NI", {
      style: "currency",
      currency: currency || "NIO",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "NIO"} ${Number(value || 0).toFixed(2)}`;
  }
}

function readableDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("es-NI", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml({ companyName, customerName, title, body, accent, replyTo }) {
  const paragraphs = String(body || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 14px;line-height:1.65;color:#334155">${escapeHtml(paragraph)}</p>`)
    .join("");
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:30px 14px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0"><tr><td style="height:8px;background:${accent}"></td></tr><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(companyName)}</p><h1 style="margin:0 0 22px;font-size:27px;line-height:1.2">${escapeHtml(title)}</h1><p style="margin:0 0 14px;line-height:1.65;color:#334155">Hola ${escapeHtml(customerName)}, te saluda ${escapeHtml(companyName)}.</p>${paragraphs}<p style="margin:26px 0 0;color:#64748b;font-size:12px;line-height:1.5">Este es un aviso transaccional relacionado con tu cuenta.${replyTo ? ` Puedes responder a ${escapeHtml(replyTo)} si necesitas ayuda.` : ""}</p></td></tr></table></td></tr></table></body></html>`;
}

export function buildNotificationContent({
  event,
  candidate,
  company,
  today,
  whatsappTemplate = "",
  replyTo = "",
}) {
  if (!EVENT_TYPES.has(event)) throw new Error(`Evento de notificación no soportado: ${event}`);
  const customerName = fullName(candidate.client);
  const companyName = company?.nombre || "ActiveSelfControl";
  const currency = candidate.payment?.moneda || company?.currency || "NIO";
  const planName = candidate.plan?.nombre || "tu plan";
  const variables = {
    nombre: customerName,
    empresa: companyName,
    cliente_nombre: customerName,
    empresa_nombre: companyName,
    plan: planName,
    monto: candidate.payment ? money(candidate.payment.monto, currency) : "",
    fecha_vencimiento: candidate.payment ? readableDate(candidate.payment.fecha_vencimiento) : "",
    referencia: candidate.payment?.referencia || (candidate.payment ? `P-${candidate.payment.id}` : ""),
    fecha_fin: candidate.subscription ? readableDate(candidate.subscription.fecha_fin) : "",
    dias_restantes: candidate.subscription
      ? String(daysBetweenIsoDates(today, candidate.subscription.fecha_fin))
      : "",
  };

  let title;
  let subject;
  let body;
  let accent;
  if (event === "suscripcion_por_vencer") {
    title = "Tu suscripción está próxima a vencer";
    subject = `${companyName} · tu suscripción vence ${variables.fecha_fin}`;
    body = `Tu plan ${planName} finaliza el ${variables.fecha_fin}. Te quedan ${variables.dias_restantes} día(s) de vigencia.\nContáctanos para renovar a tiempo y mantener tu acceso sin interrupciones.`;
    accent = "#f59e0b";
  } else if (event === "pago_vencido") {
    title = "Tienes un pago pendiente";
    subject = `${companyName} · recordatorio de pago vencido`;
    body = `Registramos un saldo pendiente de ${variables.monto}, con vencimiento el ${variables.fecha_vencimiento}.\nSi ya realizaste el pago, puedes ignorar este mensaje o responder con tu comprobante.`;
    accent = "#dc2626";
  } else if (event === "factura_emitida") {
    title = "Confirmación de pago";
    subject = `${companyName} · pago ${variables.referencia} confirmado`;
    body = `Confirmamos tu pago ${variables.referencia} por ${variables.monto}. Gracias por mantener tu cuenta al día.`;
    accent = "#16a34a";
  } else {
    title = `Te damos la bienvenida a ${companyName}`;
    subject = `${companyName} · bienvenida`;
    body = "Tu registro ya está activo. Desde ahora podremos mantenerte informado sobre pagos, comprobantes y la vigencia de tu suscripción.";
    accent = "#0284c7";
  }

  const greeting = `Hola ${customerName}, te saluda ${companyName}.`;
  return {
    subject,
    text: `${greeting}\n\n${body}\n\nQuedamos atentos para ayudarte.`,
    html: emailHtml({ companyName, customerName, title, body, accent, replyTo }),
    whatsapp: `${greeting} ${whatsappTemplate ? renderVariables(whatsappTemplate, variables) : body.replaceAll("\n", " ")}`,
    variables,
  };
}
