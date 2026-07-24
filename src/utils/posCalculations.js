const MONEY_SCALE = 100;

function toMinor(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * MONEY_SCALE);
}

function fromMinor(value) {
  return Number((value / MONEY_SCALE).toFixed(2));
}

export function calculateLineAmounts({
  quantity,
  salePrice,
  purchasePrice = 0,
  taxRate = 0,
  pricesIncludeTax = true,
  taxable = true,
}) {
  const safeQuantity = Math.max(0, Number(quantity || 0));
  const grossMinor = Math.round(toMinor(salePrice) * safeQuantity);
  const costMinor = Math.round(toMinor(purchasePrice) * safeQuantity);
  const safeTaxRate = taxable
    ? Math.max(0, Math.min(100, Number(taxRate || 0)))
    : 0;

  let subtotalMinor = grossMinor;
  let taxMinor = 0;
  let totalMinor = grossMinor;

  if (safeTaxRate > 0 && pricesIncludeTax) {
    subtotalMinor = Math.round(grossMinor / (1 + safeTaxRate / 100));
    taxMinor = grossMinor - subtotalMinor;
  } else if (safeTaxRate > 0) {
    taxMinor = Math.round(grossMinor * safeTaxRate / 100);
    totalMinor = grossMinor + taxMinor;
  }

  return {
    subtotal: fromMinor(subtotalMinor),
    tax: fromMinor(taxMinor),
    total: fromMinor(totalMinor),
    cost: fromMinor(costMinor),
    profit: fromMinor(subtotalMinor - costMinor),
  };
}

export function calculateSaleTotals(lines = []) {
  const totals = lines.reduce(
    (result, line) => ({
      subtotal: result.subtotal + toMinor(line.subtotal),
      tax: result.tax + toMinor(line.impuesto_total ?? line.tax),
      total: result.total + toMinor(line.total),
      cost: result.cost + toMinor(line.costo_total ?? line.cost),
      profit: result.profit + toMinor(line.ganancia ?? line.profit),
      quantity: result.quantity + Number(line.cantidad ?? line.quantity ?? 0),
    }),
    { subtotal: 0, tax: 0, total: 0, cost: 0, profit: 0, quantity: 0 }
  );

  return {
    subtotal: fromMinor(totals.subtotal),
    tax: fromMinor(totals.tax),
    total: fromMinor(totals.total),
    cost: fromMinor(totals.cost),
    profit: fromMinor(totals.profit),
    quantity: totals.quantity,
  };
}
