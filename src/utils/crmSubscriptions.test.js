import test from "node:test";
import assert from "node:assert/strict";
import { calculateSubscriptionEnd } from "./crmSubscriptions.js";

test("calculateSubscriptionEnd cuenta la fecha inicial como el primer día", () => {
  assert.equal(calculateSubscriptionEnd("2026-07-29", 30), "2026-08-27");
  assert.equal(calculateSubscriptionEnd("2026-07-29", 15), "2026-08-12");
  assert.equal(calculateSubscriptionEnd("2026-07-29", 1), "2026-07-29");
});

test("calculateSubscriptionEnd cruza meses y años sin depender de la zona horaria", () => {
  assert.equal(calculateSubscriptionEnd("2024-02-01", 30), "2024-03-01");
  assert.equal(calculateSubscriptionEnd("2026-12-31", 2), "2027-01-01");
});

test("calculateSubscriptionEnd rechaza fechas y duraciones inválidas", () => {
  assert.equal(calculateSubscriptionEnd("2026-02-30", 30), "");
  assert.equal(calculateSubscriptionEnd("29/07/2026", 30), "");
  assert.equal(calculateSubscriptionEnd("2026-07-29", 0), "");
});

