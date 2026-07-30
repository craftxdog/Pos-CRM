import createPdf from "../utils/CreatePdf";
import { urlToBase64 } from "../utils/Conversiones";
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

const noBorder = [false, false, false, false];
const divider = (margin = [0, 9, 0, 9]) => ({
  canvas: [
    {
      type: "line",
      x1: 0,
      y1: 0,
      x2: 202,
      y2: 0,
      lineWidth: 0.7,
      lineColor: "#cbd5e1",
    },
  ],
  margin,
});

async function companyLogo(dataempresa) {
  const logo = dataempresa?.logo;
  if (!logo || logo === "-") return null;

  try {
    return await urlToBase64(logo);
  } catch {
    return null;
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
  const logo = await companyLogo(dataempresa);
  const amount = (value) =>
    currency(value, invoice.payment.currency, dataempresa?.iso);
  const documentTitle = invoice.payment.appliesToPlan
    ? "RECIBO DE ABONO"
    : "FACTURA CRM";
  const statusColor =
    invoice.payment.remainingBalance === 0 ? "#15803d" : "#b45309";
  const statusBackground =
    invoice.payment.remainingBalance === 0 ? "#dcfce7" : "#fef3c7";

  const clientRows = [
    ["CLIENTE", invoice.client.name],
    ["IDENTIFICACIÓN", invoice.client.taxId],
    ["TELÉFONO", invoice.client.phone],
    ["CORREO", invoice.client.email],
    ["DIRECCIÓN", invoice.client.address],
  ].filter(([, value]) => value && value !== "-");

  const accountRows = invoice.payment.appliesToPlan
    ? [
        ["VALOR DEL PLAN", amount(invoice.payment.planTotal), "#0f172a"],
        [
          "ABONADO ACUMULADO",
          amount(invoice.payment.cumulativePaid),
          "#15803d",
        ],
        [
          "SALDO PENDIENTE",
          amount(invoice.payment.remainingBalance),
          statusColor,
        ],
      ]
    : [];

  const content = [
    {
      canvas: [
        { type: "rect", x: 0, y: 0, w: 202, h: 6, color: "#0ea5e9" },
      ],
      margin: [0, 0, 0, 12],
    },
    ...(logo
      ? [
          {
            image: logo,
            fit: [92, 58],
            alignment: "center",
            margin: [0, 0, 0, 7],
          },
        ]
      : []),
    { text: invoice.company.name.toUpperCase(), style: "brand" },
    {
      text: [
        invoice.company.address !== "-" ? invoice.company.address : "",
        invoice.company.taxId !== "-" ? `RUC/ID: ${invoice.company.taxId}` : "",
        invoice.company.email,
      ]
        .filter(Boolean)
        .join("\n"),
      style: "company",
      margin: [8, 4, 8, 0],
    },
    divider([0, 11, 0, 8]),
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: documentTitle, style: "documentTitle" },
                { text: invoice.number, style: "documentNumber" },
              ],
              fillColor: "#e0f2fe",
              border: noBorder,
              margin: [8, 7, 8, 7],
            },
          ],
        ],
      },
      layout: "noBorders",
    },
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: invoice.status,
              alignment: "center",
              bold: true,
              fontSize: 8,
              color: statusColor,
              fillColor: statusBackground,
              border: noBorder,
              margin: [6, 4, 6, 4],
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [46, 5, 46, 0],
    },
    {
      columns: [
        [
          { text: "EMISIÓN", style: "microLabel" },
          { text: invoice.issueDate, style: "microValue" },
        ],
        [
          { text: "VENCIMIENTO", style: "microLabel", alignment: "right" },
          { text: invoice.dueDate, style: "microValue", alignment: "right" },
        ],
      ],
      margin: [0, 10, 0, 0],
    },
    divider(),
    { text: "DATOS DEL CLIENTE", style: "sectionTitle" },
    {
      table: {
        widths: [62, "*"],
        body: clientRows.map(([label, value]) => [
          {
            text: label,
            style: "label",
            border: noBorder,
            margin: [0, 2, 0, 2],
          },
          {
            text: value,
            style: "value",
            alignment: "right",
            border: noBorder,
            margin: [0, 2, 0, 2],
          },
        ]),
      },
      layout: "noBorders",
      margin: [0, 4, 0, 0],
    },
    divider(),
    { text: "DETALLE DEL SERVICIO", style: "sectionTitle" },
    {
      text: invoice.item.description.toUpperCase(),
      bold: true,
      fontSize: 9.5,
      color: "#0f172a",
      margin: [0, 6, 0, 2],
    },
    ...(invoice.item.detail
      ? [{ text: invoice.item.detail, style: "muted", margin: [0, 0, 0, 4] }]
      : []),
    {
      text: `Periodo: ${invoice.item.periodStart} – ${invoice.item.periodEnd}`,
      style: "muted",
      margin: [0, 1, 0, 7],
    },
    {
      table: {
        headerRows: 1,
        widths: ["*", 32, 61],
        body: [
          [
            { text: "DESCRIPCIÓN", style: "tableHead" },
            { text: "CANT.", style: "tableHead", alignment: "center" },
            { text: "IMPORTE", style: "tableHead", alignment: "right" },
          ],
          [
            {
              text: "Servicio CRM",
              style: "value",
              border: noBorder,
              margin: [5, 6, 2, 6],
            },
            {
              text: String(invoice.item.quantity),
              style: "value",
              alignment: "center",
              border: noBorder,
              margin: [2, 6, 2, 6],
            },
            {
              text: amount(invoice.item.total),
              style: "amount",
              border: noBorder,
              margin: [2, 6, 5, 6],
            },
          ],
        ],
      },
      layout: {
        hLineColor: () => "#cbd5e1",
        vLineColor: () => "#e2e8f0",
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    },
    {
      table: {
        widths: ["*", 82],
        body: [
          [
            {
              text: "SUBTOTAL",
              style: "label",
              border: noBorder,
              margin: [5, 7, 5, 2],
            },
            {
              text: amount(invoice.payment.subtotal),
              style: "amount",
              border: noBorder,
              margin: [5, 7, 5, 2],
            },
          ],
          [
            {
              text: invoice.payment.appliesToPlan ? "ABONO DE HOY" : "TOTAL",
              bold: true,
              fontSize: 11,
              color: "#ffffff",
              fillColor: "#0f172a",
              border: noBorder,
              margin: [7, 8, 5, 8],
            },
            {
              text: amount(invoice.payment.total),
              alignment: "right",
              bold: true,
              fontSize: 12,
              color: "#ffffff",
              fillColor: "#0f172a",
              border: noBorder,
              margin: [5, 8, 7, 8],
            },
          ],
          ...(invoice.payment.change > 0
            ? [
                [
                  {
                    text: "RECIBIDO",
                    style: "label",
                    border: noBorder,
                    margin: [5, 5, 5, 2],
                  },
                  {
                    text: amount(invoice.payment.received),
                    style: "amount",
                    border: noBorder,
                    margin: [5, 5, 5, 2],
                  },
                ],
                [
                  {
                    text: "VUELTO",
                    style: "label",
                    border: noBorder,
                    margin: [5, 2, 5, 2],
                  },
                  {
                    text: amount(invoice.payment.change),
                    style: "amount",
                    border: noBorder,
                    margin: [5, 2, 5, 2],
                  },
                ],
              ]
            : []),
        ],
      },
      layout: "noBorders",
      margin: [0, 5, 0, 0],
    },
    ...(accountRows.length
      ? [
          divider(),
          { text: "ESTADO DEL PLAN", style: "sectionTitle" },
          {
            table: {
              widths: ["*", 84],
              body: accountRows.map(([label, value, color]) => [
                {
                  text: label,
                  style: "label",
                  border: noBorder,
                  margin: [0, 3, 0, 3],
                },
                {
                  text: value,
                  style: "amount",
                  color,
                  border: noBorder,
                  margin: [0, 3, 0, 3],
                },
              ]),
            },
            layout: "noBorders",
            margin: [0, 4, 0, 0],
          },
        ]
      : []),
    divider(),
    { text: "INFORMACIÓN DEL PAGO", style: "sectionTitle" },
    {
      table: {
        widths: [62, "*"],
        body: [
          [
            { text: "MÉTODO", style: "label", border: noBorder },
            {
              text: invoice.payment.method,
              style: "value",
              alignment: "right",
              border: noBorder,
            },
          ],
          ...(invoice.payment.paymentReference
            ? [
                [
                  { text: "REFERENCIA", style: "label", border: noBorder },
                  {
                    text: invoice.payment.paymentReference,
                    style: "value",
                    alignment: "right",
                    border: noBorder,
                  },
                ],
              ]
            : []),
        ],
      },
      layout: "noBorders",
      margin: [0, 5, 0, 0],
    },
    ...(invoice.payment.notes
      ? [
          {
            text: invoice.payment.notes,
            style: "muted",
            alignment: "center",
            margin: [8, 9, 8, 0],
          },
        ]
      : []),
    {
      qr: `${invoice.company.taxId}|${invoice.number}|${invoice.payment.total}|${invoice.issueDate}`,
      fit: 72,
      alignment: "center",
      eccLevel: "Q",
      margin: [0, 14, 0, 5],
    },
    {
      text: "Gracias por su preferencia",
      alignment: "center",
      bold: true,
      fontSize: 9,
      color: "#0f172a",
    },
    {
      text: "Conserve este comprobante como respaldo de su pago.",
      style: "muted",
      alignment: "center",
      margin: [10, 3, 10, 0],
    },
  ];

  return createPdf(
    {
      pageSize: { width: 226.77, height: "auto" },
      pageMargins: [12, 10, 12, 14],
      info: {
        title: `${documentTitle} ${invoice.number}`,
        author: invoice.company.name,
        subject: "Comprobante de pago CRM",
      },
      styles: {
        brand: {
          alignment: "center",
          bold: true,
          fontSize: 14,
          color: "#0f172a",
        },
        company: {
          alignment: "center",
          fontSize: 7.5,
          color: "#475569",
          lineHeight: 1.25,
        },
        documentTitle: {
          alignment: "center",
          bold: true,
          fontSize: 10,
          color: "#075985",
        },
        documentNumber: {
          alignment: "center",
          bold: true,
          fontSize: 11,
          color: "#0f172a",
          margin: [0, 2, 0, 0],
        },
        sectionTitle: {
          bold: true,
          fontSize: 7.5,
          color: "#0284c7",
          characterSpacing: 0.4,
        },
        microLabel: {
          bold: true,
          fontSize: 6.5,
          color: "#64748b",
        },
        microValue: {
          bold: true,
          fontSize: 8,
          color: "#0f172a",
        },
        label: { bold: true, fontSize: 7.3, color: "#64748b" },
        value: { fontSize: 8, color: "#0f172a" },
        amount: {
          alignment: "right",
          bold: true,
          fontSize: 8.5,
          color: "#0f172a",
        },
        muted: {
          fontSize: 7.2,
          color: "#64748b",
          lineHeight: 1.2,
        },
        tableHead: {
          bold: true,
          fontSize: 7,
          color: "#334155",
          fillColor: "#f1f5f9",
          border: noBorder,
          margin: [5, 5, 5, 5],
        },
      },
      content,
    },
    output
  );
}
