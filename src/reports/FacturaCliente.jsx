import createPdf from "../utils/CreatePdf";
import { buildCrmInvoiceModel } from "../utils/crmInvoice";

function currency(value, code, locale) {
  try {
    return new Intl.NumberFormat(locale || "es-NI", {
      style: "currency",
      currency: code || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${code || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

export default async function FacturaCliente(
  output,
  { dataempresa, pago, cliente, suscripcion, plan }
) {
  const invoice = buildCrmInvoiceModel({
    company: dataempresa,
    payment: pago,
    client: cliente,
    subscription: suscripcion,
    plan,
  });
  const amount = (value) =>
    currency(value, invoice.payment.currency, dataempresa?.iso);
  const totalsRows = [
    [
      { text: "Subtotal", style: "totalLabel", border: [false, false, false, true], margin: [5, 8] },
      { text: amount(invoice.payment.subtotal), alignment: "right", border: [false, false, false, true], margin: [5, 8] },
    ],
    [
      { text: "TOTAL", style: "total", border: [false, false, false, false], margin: [5, 10] },
      { text: amount(invoice.payment.total), style: "total", alignment: "right", border: [false, false, false, false], margin: [5, 10] },
    ],
  ];
  if (invoice.payment.change > 0) {
    totalsRows.push(
      [
        { text: "Recibido", style: "totalLabel", border: [false, true, false, false], margin: [5, 8] },
        { text: amount(invoice.payment.received), alignment: "right", border: [false, true, false, false], margin: [5, 8] },
      ],
      [
        { text: "Vuelto", style: "totalLabel", border: [false, false, false, false], margin: [5, 8] },
        { text: amount(invoice.payment.change), alignment: "right", border: [false, false, false, false], margin: [5, 8] },
      ]
    );
  }

  return createPdf(
    {
      pageSize: "A4",
      pageMargins: [38, 38, 38, 44],
      info: {
        title: `Factura ${invoice.number}`,
        subject: `Factura de ${invoice.client.name}`,
        author: invoice.company.name,
      },
      styles: {
        company: { fontSize: 20, bold: true, color: "#111827" },
        muted: { fontSize: 9, color: "#64748b", lineHeight: 1.25 },
        section: { fontSize: 9, bold: true, color: "#475569" },
        tableHeader: { fontSize: 9, bold: true, color: "#111827" },
        tableCell: { fontSize: 9, color: "#334155" },
        totalLabel: { fontSize: 10, bold: true, color: "#475569" },
        total: { fontSize: 14, bold: true, color: "#111827" },
      },
      content: [
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: invoice.company.name, style: "company" },
                { text: invoice.company.address, style: "muted", margin: [0, 5, 0, 0] },
                { text: `ID fiscal: ${invoice.company.taxId}`, style: "muted" },
                invoice.company.email
                  ? { text: invoice.company.email, style: "muted" }
                  : { text: "" },
              ],
            },
            {
              width: 190,
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      stack: [
                        { text: "FACTURA", fontSize: 22, bold: true, alignment: "right" },
                        {
                          text: invoice.number,
                          fontSize: 11,
                          bold: true,
                          alignment: "right",
                          color: "#8a7600",
                          margin: [0, 4, 0, 0],
                        },
                        {
                          text: invoice.status,
                          fontSize: 9,
                          bold: true,
                          alignment: "right",
                          color: invoice.status === "PAGADA" ? "#15803d" : "#b45309",
                          margin: [0, 5, 0, 0],
                        },
                      ],
                      fillColor: "#fffbea",
                      margin: [14, 12, 14, 12],
                    },
                  ],
                ],
              },
              layout: {
                hLineColor: () => "#f3d20c",
                vLineColor: () => "#f3d20c",
              },
            },
          ],
          columnGap: 24,
        },
        {
          canvas: [
            { type: "line", x1: 0, y1: 0, x2: 519, y2: 0, lineWidth: 1, lineColor: "#e2e8f0" },
          ],
          margin: [0, 24, 0, 20],
        },
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: "FACTURAR A", style: "section" },
                { text: invoice.client.name, bold: true, fontSize: 12, margin: [0, 5, 0, 3] },
                { text: `ID: ${invoice.client.taxId}`, style: "muted" },
                { text: invoice.client.email, style: "muted" },
                { text: invoice.client.phone, style: "muted" },
                { text: invoice.client.address, style: "muted" },
              ],
            },
            {
              width: 190,
              table: {
                widths: [85, "*"],
                body: [
                  [
                    { text: "Emisión", style: "section", border: [false, false, false, true] },
                    { text: invoice.issueDate, alignment: "right", style: "tableCell", border: [false, false, false, true] },
                  ],
                  [
                    { text: "Vencimiento", style: "section", border: [false, false, false, false] },
                    { text: invoice.dueDate, alignment: "right", style: "tableCell", border: [false, false, false, false] },
                  ],
                ],
              },
              layout: { hLineColor: () => "#e2e8f0" },
            },
          ],
          columnGap: 24,
          margin: [0, 0, 0, 26],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 46, 82, 82],
            body: [
              [
                { text: "DESCRIPCIÓN", style: "tableHeader", fillColor: "#f8fafc", margin: [7, 7] },
                { text: "CANT.", style: "tableHeader", alignment: "center", fillColor: "#f8fafc", margin: [7, 7] },
                { text: "PRECIO", style: "tableHeader", alignment: "right", fillColor: "#f8fafc", margin: [7, 7] },
                { text: "TOTAL", style: "tableHeader", alignment: "right", fillColor: "#f8fafc", margin: [7, 7] },
              ],
              [
                {
                  stack: [
                    { text: invoice.item.description, bold: true, fontSize: 10 },
                    invoice.item.detail
                      ? { text: invoice.item.detail, style: "muted", margin: [0, 3, 0, 0] }
                      : { text: "" },
                    {
                      text: `Periodo: ${invoice.item.periodStart} – ${invoice.item.periodEnd}`,
                      style: "muted",
                      margin: [0, 4, 0, 0],
                    },
                  ],
                  margin: [7, 8],
                },
                { text: "1", alignment: "center", style: "tableCell", margin: [7, 8] },
                { text: amount(invoice.item.unitPrice), alignment: "right", style: "tableCell", margin: [7, 8] },
                { text: amount(invoice.item.total), alignment: "right", bold: true, fontSize: 9, margin: [7, 8] },
              ],
            ],
          },
          layout: {
            hLineColor: () => "#e2e8f0",
            vLineColor: () => "#e2e8f0",
          },
        },
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: "MÉTODO DE PAGO", style: "section" },
                { text: invoice.payment.method, fontSize: 10, margin: [0, 5, 0, 0] },
                invoice.payment.paymentReference
                  ? { text: `Referencia: ${invoice.payment.paymentReference}`, style: "muted", margin: [0, 4, 0, 0] }
                  : { text: "" },
                invoice.payment.notes
                  ? { text: invoice.payment.notes, style: "muted", margin: [0, 5, 0, 0] }
                  : { text: "" },
              ],
            },
            {
              width: 210,
              table: {
                widths: ["*", 105],
                body: totalsRows,
              },
              layout: { hLineColor: () => "#e2e8f0" },
            },
          ],
          columnGap: 28,
          margin: [0, 20, 0, 0],
        },
        {
          text: "Gracias por su preferencia.",
          alignment: "center",
          color: "#64748b",
          fontSize: 9,
          margin: [0, 40, 0, 0],
        },
      ],
    },
    output
  );
}
