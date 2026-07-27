import createPdf from "../utils/CreatePdf";

const money = (value, code, locale) => {
  try { return new Intl.NumberFormat(locale || "es-NI", { style: "currency", currency: code || "USD" }).format(Number(value || 0)); }
  catch { return `${code || "USD"} ${Number(value || 0).toFixed(2)}`; }
};
const nameOf = (row) => [row?.cliente_nombres, row?.cliente_apellidos].filter(Boolean).join(" ") || "Cliente";
const dateOf = (value) => value ? new Intl.DateTimeFormat("es-NI", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

export default async function ReporteCobrosCrm(output, { dataempresa, month, rows = [], monthlyRows = [] }) {
  const total = rows.reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const totalReceived = rows.reduce((sum, item) => sum + Number(item.monto_recibido || item.monto || 0), 0);
  const totalChange = rows.reduce((sum, item) => sum + Number(item.vuelto || 0), 0);
  const currency = dataempresa?.currency || rows[0]?.moneda || "USD";
  const rowsForPdf = rows.map((item) => [
    { text: item.referencia || "—", style: "body" },
    { text: nameOf(item), style: "body" },
    { text: dateOf(item.fecha_pago), style: "body" },
    { text: String(item.metodo_pago || "—").toUpperCase(), style: "body" },
    { text: money(item.monto, item.moneda || currency, dataempresa?.iso), style: "amount" },
  ]);

  return createPdf({
    pageSize: "A4",
    pageMargins: [34, 34, 34, 42],
    info: { title: `Informe CRM ${month}`, author: dataempresa?.nombre || "CRM" },
    styles: {
      title: { fontSize: 22, bold: true, color: "#0f172a" },
      subtitle: { fontSize: 9, color: "#64748b" },
      label: { fontSize: 9, bold: true, color: "#475569" },
      value: { fontSize: 14, bold: true, color: "#0f172a" },
      head: { fontSize: 8, bold: true, color: "#334155" },
      body: { fontSize: 8, color: "#0f172a" },
      amount: { fontSize: 8, bold: true, alignment: "right", color: "#0f172a" },
    },
    content: [
      { canvas: [{ type: "rect", x: 0, y: 0, w: 527, h: 7, color: "#0ea5e9" }], margin: [0, 0, 0, 18] },
      { columns: [
        [{ text: "INFORME DE COBROS CRM", style: "title" }, { text: `${dataempresa?.nombre || "Empresa"} · Periodo ${month}`, style: "subtitle", margin: [0, 4, 0, 0] }],
        [{ text: `Generado: ${new Intl.DateTimeFormat("es-NI", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, style: "subtitle", alignment: "right" }],
      ] },
      { columns: [
        [{ text: "INGRESOS", style: "label" }, { text: money(total, currency, dataempresa?.iso), style: "value" }],
        [{ text: "COBROS", style: "label" }, { text: String(rows.length), style: "value" }],
        [{ text: "RECIBIDO", style: "label" }, { text: money(totalReceived, currency, dataempresa?.iso), style: "value" }],
        [{ text: "VUELTO", style: "label" }, { text: money(totalChange, currency, dataempresa?.iso), style: "value" }],
      ], columnGap: 11, margin: [0, 22, 0, 18] },
      { text: "DETALLE DE COMPROBANTES", style: "label", margin: [0, 0, 0, 7] },
      { table: { headerRows: 1, widths: [88, "*", 90, 65, 74], body: [
        ["DOCUMENTO", "CLIENTE", "FECHA", "MÉTODO", "TOTAL"].map((text) => ({ text, style: "head", fillColor: "#eaf3fb", margin: [5, 6, 5, 6] })),
        ...(rowsForPdf.length ? rowsForPdf : [[{ text: "No hay cobros en este periodo.", colSpan: 5, style: "body", alignment: "center", margin: [5, 12, 5, 12] }, {}, {}, {}, {}]]),
      ] }, layout: { hLineColor: () => "#cbd5e1", vLineColor: () => "#e2e8f0", paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 3, paddingBottom: () => 3 } },
      monthlyRows.length ? { text: `Resumen por método: ${monthlyRows.map((item) => `${item.metodo_pago}: ${money(item.total_ingresos, currency, dataempresa?.iso)}`).join(" · ")}`, style: "subtitle", margin: [0, 14, 0, 0] } : { text: "" },
      { text: "Este documento consolida los cobros registrados en Caja CRM. Los comprobantes individuales pueden reimprimirse desde el historial.", style: "subtitle", margin: [0, 24, 0, 0] },
    ],
  }, output);
}
