import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_DATE_RANGE,
  calculatePreviousDateRange,
  isAllDateRange,
  toLocalDateKey,
} from "./dashboardDates.js";

test("calcula el día anterior para un filtro de un solo día", () => {
  assert.deepEqual(calculatePreviousDateRange("2026-07-30", "2026-07-30"), {
    fechaAnteriorInicio: "2026-07-29",
    fechaAnteriorFin: "2026-07-29",
  });
});

test("calcula un período anterior inclusivo sin solaparlo", () => {
  assert.deepEqual(calculatePreviousDateRange("2026-07-24", "2026-07-30"), {
    fechaAnteriorInicio: "2026-07-17",
    fechaAnteriorFin: "2026-07-23",
  });
});

test("no compara rangos abiertos o inválidos", () => {
  assert.equal(
    isAllDateRange(ALL_DATE_RANGE.fechaInicio, ALL_DATE_RANGE.fechaFin),
    true
  );
  assert.deepEqual(
    calculatePreviousDateRange(ALL_DATE_RANGE.fechaInicio, ALL_DATE_RANGE.fechaFin),
    { fechaAnteriorInicio: null, fechaAnteriorFin: null }
  );
  assert.deepEqual(calculatePreviousDateRange("2026-08-01", "2026-07-01"), {
    fechaAnteriorInicio: null,
    fechaAnteriorFin: null,
  });
});

test("crea una fecha local sin desplazarla por zona horaria", () => {
  assert.equal(toLocalDateKey(new Date(2026, 6, 30, 23, 45)), "2026-07-30");
});
