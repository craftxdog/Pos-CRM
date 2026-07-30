import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsappReceiptMessage,
  buildWhatsappReceiptUrl,
  normalizeWhatsappPhone,
} from "./crmWhatsapp.js";

test("normaliza un teléfono local con el código de país", () => {
  assert.equal(normalizeWhatsappPhone("8888-9999", "+505"), "50588889999");
  assert.equal(
    normalizeWhatsappPhone("+505 8888 9999", "505"),
    "50588889999",
  );
});

test("prepara el comprobante para WhatsApp con saldo de plan", () => {
  const receipt = {
    referencia: "FAC-25",
    cliente_nombres: "Luisa",
    monto: 200,
    moneda: "NIO",
    metodo_pago: "efectivo",
    fecha_pago: "2026-07-30T12:00:00Z",
    plan_nombre: "Plan mensual",
    aplica_a_saldo_plan: true,
    abonado_acumulado: 500,
    saldo_pendiente: 300,
    currentPhone: "88889999",
  };
  const message = buildWhatsappReceiptMessage({
    receipt,
    company: { nombre: "Agoge Academy", iso: "es-NI" },
  });
  const url = buildWhatsappReceiptUrl({
    receipt,
    company: { nombre: "Agoge Academy", iso: "es-NI" },
    defaultCountryCode: "505",
  });

  assert.match(message, /FAC-25/);
  assert.match(message, /Saldo pendiente/);
  assert.match(url, /^https:\/\/wa\.me\/50588889999\?text=/);
});
