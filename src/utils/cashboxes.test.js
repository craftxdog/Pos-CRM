import assert from "node:assert/strict";
import test from "node:test";

import { filterActiveCashboxAssignments } from "./cashboxes.js";

test("muestra únicamente asignaciones con una caja activa y válida", () => {
  const assignments = [
    {
      id: 1,
      id_caja: 10,
      caja: { descripcion: "Principal", estado: "activa" },
    },
    {
      id: 2,
      id_caja: 20,
      caja: { descripcion: "Caja retirada", estado: "inactiva" },
    },
    { id: 3, id_caja: null, caja: null },
    {
      id: 4,
      id_caja: 40,
      caja: { descripcion: "", estado: "activa" },
    },
  ];

  assert.deepEqual(filterActiveCashboxAssignments(assignments), [
    assignments[0],
  ]);
});

test("tolera respuestas vacías o incompletas sin crear tarjetas inválidas", () => {
  assert.deepEqual(filterActiveCashboxAssignments(null), []);
  assert.deepEqual(filterActiveCashboxAssignments(undefined), []);
  assert.deepEqual(filterActiveCashboxAssignments([{}]), []);
});
