export function calculateSubscriptionAccount(subscription, payments = []) {
  const total = Number(
    subscription?.precio_pactado || subscription?.crm_planes?.precio || 0
  );

  if (!subscription) {
    return { total: 0, paid: 0, balance: 0 };
  }

  const paid = payments
    .filter(
      (payment) =>
        String(payment.id_suscripcion) === String(subscription.id) &&
        payment.estado === "pagado" &&
        payment.aplica_a_saldo_plan &&
        payment.periodo_inicio === subscription.fecha_inicio &&
        payment.periodo_fin === subscription.fecha_fin
    )
    .reduce((sum, payment) => sum + Number(payment.monto || 0), 0);

  return {
    total,
    paid: Math.min(total, paid),
    balance: Math.max(0, total - paid),
  };
}

export function adjustInstallmentToReceived(installment, received) {
  const currentAmount = Math.max(0, Number(installment || 0));
  const receivedAmount = Math.max(0, Number(received || 0));

  if (receivedAmount > 0 && receivedAmount < currentAmount) {
    return receivedAmount;
  }

  return currentAmount;
}

export function resolveClientChargeTarget({
  client,
  subscriptions = [],
  payments = [],
}) {
  if (!client?.id) {
    return {
      mode: "none",
      clientId: "",
      subscriptionId: "",
      amount: 0,
    };
  }

  const available = subscriptions.filter(
    (subscription) =>
      subscription.estado !== "cancelada" &&
      String(subscription.id_cliente_crm) === String(client.id)
  );
  const subscription =
    available.find(
      (candidate) =>
        client.id_suscripcion &&
        String(candidate.id) === String(client.id_suscripcion)
    ) || available[0];
  const account = calculateSubscriptionAccount(subscription, payments);

  if (subscription && account.balance > 0) {
    return {
      mode: "subscription",
      clientId: String(client.id),
      subscriptionId: String(subscription.id),
      amount: account.balance,
    };
  }

  return {
    mode: "direct",
    clientId: String(client.id),
    subscriptionId: subscription ? String(subscription.id) : "",
    amount: Math.max(0, Number(client.saldo_vencido || 0)),
  };
}
