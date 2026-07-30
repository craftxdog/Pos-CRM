export function normalizeWhatsappPhone(phone, defaultCountryCode = "505") {
  const digits = String(phone || "").replace(/\D/g, "");
  const country = String(defaultCountryCode || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!country || digits.startsWith(country) || digits.length > 10) {
    return digits;
  }
  return `${country}${digits}`;
}

const formatMoney = (value, currency, locale) => {
  try {
    return new Intl.NumberFormat(locale || "es-NI", {
      style: "currency",
      currency: currency || "NIO",
    }).format(Number(value || 0));
  } catch {
    return `${currency || "NIO"} ${Number(value || 0).toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "medium" }).format(
    new Date(value),
  );
};

export function buildWhatsappReceiptMessage({ receipt, company }) {
  const customer =
    [receipt?.cliente_nombres, receipt?.cliente_apellidos]
      .filter(Boolean)
      .join(" ") || "cliente";
  const currency = receipt?.moneda || company?.currency || "NIO";
  const locale = company?.iso || "es-NI";
  const lines = [
    `Hola ${customer},`,
    "",
    `Te compartimos tu comprobante ${receipt?.referencia || `#${receipt?.id || ""}`}.`,
    `Empresa: ${company?.nombre || company?.razon_social || "ActiveSelfControl"}`,
    `Fecha: ${formatDate(receipt?.fecha_pago)}`,
    `Concepto: ${receipt?.plan_nombre || "Cobro general"}`,
    `Monto pagado: ${formatMoney(receipt?.monto, currency, locale)}`,
    `Método: ${receipt?.metodo_pago || "No especificado"}`,
  ];

  if (receipt?.aplica_a_saldo_plan) {
    lines.push(
      `Abonado acumulado: ${formatMoney(receipt?.abonado_acumulado, currency, locale)}`,
      `Saldo pendiente: ${formatMoney(receipt?.saldo_pendiente, currency, locale)}`,
    );
  }

  lines.push("", "Gracias por tu pago.");
  return lines.join("\n");
}

export function buildWhatsappReceiptUrl({
  receipt,
  company,
  defaultCountryCode,
}) {
  const phone = normalizeWhatsappPhone(
    receipt?.currentPhone || receipt?.cliente_telefono,
    defaultCountryCode,
  );
  if (!phone) return "";
  const message = buildWhatsappReceiptMessage({ receipt, company });
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
