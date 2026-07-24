import test from "node:test";
import assert from "node:assert/strict";
import { calculateLineAmounts, calculateSaleTotals } from "./posCalculations.js";

test("separa correctamente un impuesto incluido en el precio", () => {
  assert.deepEqual(
    calculateLineAmounts({
      quantity: 2,
      salePrice: 113,
      purchasePrice: 50,
      taxRate: 13,
      pricesIncludeTax: true,
    }),
    { subtotal: 200, tax: 26, total: 226, cost: 100, profit: 100 }
  );
});

test("agrega correctamente un impuesto no incluido", () => {
  assert.deepEqual(
    calculateLineAmounts({
      quantity: 3,
      salePrice: 10,
      purchasePrice: 4,
      taxRate: 15,
      pricesIncludeTax: false,
    }),
    { subtotal: 30, tax: 4.5, total: 34.5, cost: 12, profit: 18 }
  );
});

test("acumula centavos sin el error clasico de coma flotante", () => {
  const line = calculateLineAmounts({ quantity: 3, salePrice: 0.1 });
  assert.equal(line.total, 0.3);
  assert.equal(calculateSaleTotals([line, line]).total, 0.6);
});
