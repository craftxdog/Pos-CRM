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
