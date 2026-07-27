import test from "node:test";
import assert from "node:assert/strict";
import { buildCrmInvoiceModel, crmInvoiceNumber } from "./crmInvoice.js";

test("uses the persisted CRM invoice reference", () => {
  assert.equal(
    crmInvoiceNumber({ id: 8, referencia: "FAC-2-2026-000008" }),
    "FAC-2-2026-000008"
  );
});

test("builds a printable invoice from a payment and its subscription", () => {
  const invoice = buildCrmInvoiceModel({
    company: {
      nombre: "MultiLot 360",
      id_fiscal: "J0001",
      direccion_fiscal: "Managua",
      currency: "USD",
      iso: "es-NI",
    },
    payment: {
      id: 18,
      referencia: "FAC-4-2026-000018",
      monto: 35,
      moneda: "USD",
      estado: "pagado",
      metodo_pago: "Tarjeta",
      periodo_inicio: "2026-07-24",
      periodo_fin: "2026-08-23",
      clientes_crm: {
        nombres: "Ana",
        apellidos: "López",
        email: "ana@example.com",
      },
      crm_suscripciones: {
        crm_planes: { nombre: "Mensual", descripcion: "Acceso por 30 días" },
      },
    },
  });

  assert.equal(invoice.number, "FAC-4-2026-000018");
  assert.equal(invoice.client.name, "Ana López");
  assert.equal(invoice.item.description, "Plan Mensual");
  assert.equal(invoice.payment.total, 35);
  assert.equal(invoice.status, "PAGADA");
});

test("includes the POS cash received, change and transfer reference", () => {
  const invoice = buildCrmInvoiceModel({
    company: { currency: "NIO", iso: "es-NI" },
    payment: {
      monto: 150,
      monto_recibido: 200,
      cambio: 50,
      referencia_pago: "TRX-001",
      metodo_pago: "Efectivo",
    },
  });

  assert.equal(invoice.payment.received, 200);
  assert.equal(invoice.payment.change, 50);
  assert.equal(invoice.payment.paymentReference, "TRX-001");
});
