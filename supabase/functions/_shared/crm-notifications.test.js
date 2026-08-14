import assert from "node:assert/strict";
import test from "node:test";
import {
  addIsoDays,
  buildNotificationContent,
  daysBetweenIsoDates,
  isoDateInTimeZone,
  normalizePhone,
  notificationDedupeKey,
  renderVariables,
} from "./crm-notifications.js";

test("calculates dates without a UTC off-by-one", () => {
  const instant = new Date("2026-08-15T02:30:00.000Z");
  assert.equal(isoDateInTimeZone(instant, "America/Managua"), "2026-08-14");
  assert.equal(addIsoDays("2026-08-14", 7), "2026-08-21");
  assert.equal(daysBetweenIsoDates("2026-08-14", "2026-08-15"), 1);
});
test("normalizes local and international WhatsApp numbers", () => {
  assert.equal(normalizePhone("8888-1111", "505"), "+50588881111");
  assert.equal(normalizePhone("+1 (305) 555-0100", "505"), "+13055550100");
});

test("renders tenant WhatsApp variables and keeps unknown values empty", () => {
  assert.equal(
    renderVariables("Hola {{ nombre }}, vence {{fecha_fin}} {{ignorada}}", {
      nombre: "Ana",
      fecha_fin: "15 de agosto de 2026",
    }),
    "Hola Ana, vence 15 de agosto de 2026 ",
  );
});

test("builds an idempotent subscription reminder on both channels", () => {
  const candidate = {
    client: { id: 7, nombres: "Ana", apellidos: "López", email: "ana@example.com" },
    subscription: { id: 19, fecha_fin: "2026-08-15" },
    plan: { nombre: "Premium" },
  };
  const content = buildNotificationContent({
    event: "suscripcion_por_vencer",
    candidate,
    company: { nombre: "Agoge", currency: "NIO" },
    today: "2026-08-14",
    whatsappTemplate: "Hola {{nombre}}, {{plan}} vence {{fecha_fin}}; faltan {{dias_restantes}} día(s).",
  });

  assert.equal(notificationDedupeKey("suscripcion_por_vencer", candidate), "suscripcion_por_vencer:19:2026-08-15");
  assert.match(content.subject, /Agoge/);
  assert.match(content.text, /Premium/);
  assert.match(content.whatsapp, /faltan 1 día/);
  assert.match(content.html, /Tu suscripción está próxima a vencer/);
});

test("escapes customer-controlled values in email HTML", () => {
  const content = buildNotificationContent({
    event: "cliente_creado",
    candidate: { client: { id: 8, nombres: "<script>alert(1)</script>", created_at: "2026-08-14T10:00:00Z" } },
    company: { nombre: "Agoge" },
    today: "2026-08-14",
  });
  assert.doesNotMatch(content.html, /<script>/);
  assert.match(content.html, /&lt;script&gt;/);
});
