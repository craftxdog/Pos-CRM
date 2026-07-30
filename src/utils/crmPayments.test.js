import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustInstallmentToReceived,
  calculateSubscriptionAccount,
  resolveClientChargeTarget,
} from "./crmPayments.js";

const subscription = {
  id: 14,
  id_cliente_crm: 11,
  estado: "activa",
  fecha_inicio: "2026-07-29",
  fecha_fin: "2026-08-27",
  precio_pactado: 1100,
};

test("calcula únicamente los abonos del período vigente", () => {
  const account = calculateSubscriptionAccount(subscription, [
    {
      id_suscripcion: 14,
      estado: "pagado",
      aplica_a_saldo_plan: true,
      periodo_inicio: "2026-07-29",
      periodo_fin: "2026-08-27",
      monto: 730,
    },
    {
      id_suscripcion: 14,
      estado: "pagado",
      aplica_a_saldo_plan: true,
      periodo_inicio: "2026-06-29",
      periodo_fin: "2026-07-28",
      monto: 1100,
    },
  ]);

  assert.deepEqual(account, { total: 1100, paid: 730, balance: 370 });
});

test("Cobrar abre automáticamente el saldo editable de la suscripción", () => {
  const target = resolveClientChargeTarget({
    client: { id: 11, id_suscripcion: 14, saldo_plan: 370 },
    subscriptions: [subscription],
    payments: [
      {
        id_suscripcion: 14,
        estado: "pagado",
        aplica_a_saldo_plan: true,
        periodo_inicio: "2026-07-29",
        periodo_fin: "2026-08-27",
        monto: 730,
      },
    ],
  });

  assert.deepEqual(target, {
    mode: "subscription",
    clientId: "11",
    subscriptionId: "14",
    amount: 370,
  });
});

test("ajusta el abono al efectivo completo cuando termina la captura", () => {
  assert.equal(adjustInstallmentToReceived(1100, 730), 730);
  assert.equal(adjustInstallmentToReceived(1100, 1100), 1100);
  assert.equal(adjustInstallmentToReceived(730, 1000), 730);
});

test("un cliente sin saldo de plan conserva el cobro directo", () => {
  const target = resolveClientChargeTarget({
    client: { id: 22, saldo_vencido: 125 },
    subscriptions: [],
    payments: [],
  });

  assert.deepEqual(target, {
    mode: "direct",
    clientId: "22",
    subscriptionId: "",
    amount: 125,
  });
});
