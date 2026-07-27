const invoiceStatusLabels = {
  pagado: "PAGADA",
  pendiente: "PENDIENTE",
  vencido: "VENCIDA",
  anulado: "ANULADA",
};

function dateLabel(value, locale = "es-NI") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function fullName(client) {
  return [client?.nombres, client?.apellidos].filter(Boolean).join(" ") || "Cliente";
}

export function crmInvoiceNumber(payment) {
  return payment?.referencia || `FAC-${String(payment?.id || 0).padStart(6, "0")}`;
}

export function buildCrmInvoiceModel({
  company,
  payment,
  client,
  subscription,
  plan,
}) {
  const resolvedClient = client || payment?.clientes_crm || {};
  const resolvedSubscription = subscription || payment?.crm_suscripciones || {};
  const resolvedPlan =
    plan || resolvedSubscription?.crm_planes || payment?.crm_suscripciones?.crm_planes || {};
  const amount = Number(payment?.monto ?? resolvedPlan?.precio ?? 0);
  const locale = company?.iso || "es-NI";

  return {
    number: crmInvoiceNumber(payment),
    status: invoiceStatusLabels[payment?.estado] || String(payment?.estado || "pendiente").toUpperCase(),
    issueDate: dateLabel(payment?.fecha_pago || payment?.created_at || new Date(), locale),
    dueDate: dateLabel(payment?.fecha_vencimiento || resolvedSubscription?.fecha_fin, locale),
    company: {
      name: company?.nombre || "Empresa",
      taxId: company?.id_fiscal || "-",
      address: company?.direccion_fiscal || "-",
      email: company?.correo || "",
    },
    client: {
      name: fullName(resolvedClient),
      taxId:
        resolvedClient?.identificador_fiscal ||
        resolvedClient?.identificador_nacional ||
        "-",
      email: resolvedClient?.email || "-",
      phone: resolvedClient?.telefono || "-",
      address: resolvedClient?.direccion || "-",
    },
    item: {
      description: resolvedPlan?.nombre
        ? `Plan ${resolvedPlan.nombre}`
        : payment?.notas || payment?.referencia || "Servicio CRM",
      detail: resolvedPlan?.descripcion || "",
      periodStart: dateLabel(
        payment?.periodo_inicio || resolvedSubscription?.fecha_inicio,
        locale
      ),
      periodEnd: dateLabel(
        payment?.periodo_fin || resolvedSubscription?.fecha_fin,
        locale
      ),
      quantity: 1,
      unitPrice: amount,
      total: amount,
    },
    payment: {
      currency: payment?.moneda || company?.currency || "USD",
      method: payment?.metodo_pago || "-",
      received: Number(payment?.monto_recibido ?? amount),
      change: Number(payment?.cambio || 0),
      paymentReference: payment?.referencia_pago || "",
      notes: payment?.notas || "",
      subtotal: amount,
      total: amount,
    },
  };
}
