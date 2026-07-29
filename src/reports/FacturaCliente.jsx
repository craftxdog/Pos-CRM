import createPdf from "../utils/CreatePdf";
import { buildCrmInvoiceModel } from "../utils/crmInvoice";

function currency(value, code, locale) {
  try { return new Intl.NumberFormat(locale || "es-NI", { style: "currency", currency: code || "USD" }).format(Number(value || 0)); }
  catch { return `${code || "USD"} ${Number(value || 0).toFixed(2)}`; }
}

const rule = (margin = [0, 8, 0, 8]) => ({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 203, y2: 0, dash: { length: 3 }, lineColor: "#94a3b8" }], margin });

export default async function FacturaCliente(output, { dataempresa, pago, cliente, suscripcion, plan }) {
  const invoice = buildCrmInvoiceModel({ company: dataempresa, payment: pago, client: cliente, subscription: suscripcion, plan });
  const amount = (value) => currency(value, invoice.payment.currency, dataempresa?.iso);
  const receivedRows = invoice.payment.change > 0 ? [
    [{ text: "RECIBIDO", style: "label" }, { text: amount(invoice.payment.received), style: "amount" }],
    [{ text: "VUELTO", style: "label" }, { text: amount(invoice.payment.change), style: "amount" }],
  ] : [];
  const accountRows = invoice.payment.appliesToPlan ? [
    [{ text: "VALOR DEL PLAN", style: "label" }, { text: amount(invoice.payment.planTotal), style: "amount" }],
    [{ text: "ABONADO ACUMULADO", style: "label" }, { text: amount(invoice.payment.cumulativePaid), style: "amount" }],
    [{ text: "SALDO PENDIENTE", bold: true, fontSize: 9, color: invoice.payment.remainingBalance > 0 ? "#b45309" : "#15803d" }, { text: amount(invoice.payment.remainingBalance), style: "amount", color: invoice.payment.remainingBalance > 0 ? "#b45309" : "#15803d" }],
  ] : [];
  return createPdf({
    info: { title: `Comprobante ${invoice.number}`, author: invoice.company.name },
    styles: {
      brand: { alignment: "center", bold: true, fontSize: 13, color: "#0f172a" },
      center: { alignment: "center", fontSize: 8, color: "#475569", lineHeight: 1.28 },
      label: { bold: true, fontSize: 8, color: "#475569" },
      value: { fontSize: 8, color: "#0f172a" },
      amount: { alignment: "right", bold: true, fontSize: 9, color: "#0f172a" },
      total: { alignment: "right", bold: true, fontSize: 13, color: "#0f172a" },
    },
    content: [
      { text: invoice.company.name.toUpperCase(), style: "brand" },
      { text: [invoice.company.address, invoice.company.taxId !== "-" ? `RUC/ID: ${invoice.company.taxId}` : "", invoice.company.email].filter(Boolean).join("\n"), style: "center", margin: [0, 4, 0, 0] },
      rule([0, 10, 0, 7]),
      { text: "COMPROBANTE DE PAGO", alignment: "center", bold: true, fontSize: 10 },
      { text: invoice.number, alignment: "center", bold: true, fontSize: 9, color: "#b45309", margin: [0, 3, 0, 0] },
      { text: invoice.status, alignment: "center", bold: true, fontSize: 8, color: invoice.payment.remainingBalance === 0 ? "#15803d" : "#b45309", margin: [0, 3, 0, 0] },
      rule(),
      { table: { widths: [55, "*"], body: [
        [{ text: "FECHA", style: "label", border: [false, false, false, false] }, { text: invoice.issueDate, style: "value", alignment: "right", border: [false, false, false, false] }],
        [{ text: "VENCE", style: "label", border: [false, false, false, false] }, { text: invoice.dueDate, style: "value", alignment: "right", border: [false, false, false, false] }],
        [{ text: "CLIENTE", style: "label", border: [false, false, false, false] }, { text: invoice.client.name, style: "value", alignment: "right", border: [false, false, false, false] }],
        [{ text: "CONTACTO", style: "label", border: [false, false, false, false] }, { text: invoice.client.phone !== "-" ? invoice.client.phone : invoice.client.email, style: "value", alignment: "right", border: [false, false, false, false] }],
      ] }, layout: "noBorders" },
      rule(),
      { text: invoice.item.description.toUpperCase(), bold: true, fontSize: 9, margin: [0, 0, 0, 3] },
      invoice.item.detail ? { text: invoice.item.detail, style: "center", alignment: "left" } : { text: "" },
      { text: `Periodo: ${invoice.item.periodStart} – ${invoice.item.periodEnd}`, style: "center", alignment: "left", margin: [0, 3, 0, 0] },
      { table: { widths: ["*", 58, 62], body: [
        [{ text: "DETALLE", style: "label", border: [false, false, false, true] }, { text: "CANT.", style: "label", alignment: "right", border: [false, false, false, true] }, { text: "IMPORTE", style: "label", alignment: "right", border: [false, false, false, true] }],
        [{ text: "Servicio", style: "value", border: [false, false, false, false], margin: [0, 5, 0, 3] }, { text: "1", style: "value", alignment: "right", border: [false, false, false, false], margin: [0, 5, 0, 3] }, { text: amount(invoice.item.total), style: "amount", border: [false, false, false, false], margin: [0, 5, 0, 3] }],
      ] }, layout: { hLineColor: () => "#cbd5e1" }, margin: [0, 7, 0, 0] },
      rule(),
      { table: { widths: ["*", 84], body: [
        [{ text: "SUBTOTAL", style: "label", border: [false, false, false, true] }, { text: amount(invoice.payment.subtotal), style: "amount", border: [false, false, false, true] }],
        [{ text: invoice.payment.appliesToPlan ? "ABONO DE HOY" : "TOTAL", bold: true, fontSize: 12, border: [false, false, false, false], margin: [0, 6, 0, 5] }, { text: amount(invoice.payment.total), style: "total", border: [false, false, false, false], margin: [0, 6, 0, 5] }],
        ...receivedRows.map((row) => row.map((cell) => ({ ...cell, border: [false, false, false, false] }))),
        ...accountRows.map((row) => row.map((cell) => ({ ...cell, border: [false, false, false, false], margin: [0, 3, 0, 3] }))),
      ] }, layout: { hLineColor: () => "#cbd5e1" } },
      rule(),
      { table: { widths: [55, "*"], body: [
        [{ text: "PAGO", style: "label", border: [false, false, false, false] }, { text: invoice.payment.method, style: "value", alignment: "right", border: [false, false, false, false] }],
        ...(invoice.payment.paymentReference ? [[{ text: "REFERENCIA", style: "label", border: [false, false, false, false] }, { text: invoice.payment.paymentReference, style: "value", alignment: "right", border: [false, false, false, false] }]] : []),
      ] }, layout: "noBorders" },
      invoice.payment.notes ? { text: invoice.payment.notes, style: "center", margin: [0, 9, 0, 0] } : { text: "" },
      { qr: `${invoice.company.taxId}|${invoice.number}|${invoice.payment.total}|${invoice.issueDate}`, fit: 65, alignment: "center", margin: [0, 12, 0, 4] },
      { text: "Gracias por su preferencia", style: "center" },
    ],
  }, output);
}
