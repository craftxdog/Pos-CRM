import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTime } from "./dateTime.js";

test("muestra fecha y hora de Nicaragua de forma legible", () => {
  const value = formatDateTime("2026-07-31T10:10:00+00:00");

  assert.match(value, /2026/);
  assert.match(value.toLowerCase(), /jul/);
  assert.match(value, /04:10/);
});

test("maneja valores vacíos o inválidos", () => {
  assert.equal(formatDateTime(null), "Fecha no disponible");
  assert.equal(formatDateTime("sin-fecha"), "Fecha no disponible");
});
