import test from "node:test";
import assert from "node:assert/strict";
import {
  filterCrmPlans,
  normalizeCrmPlanPayload,
} from "./crmPlans.js";

test("normalizeCrmPlanPayload limpia y convierte los valores del formulario", () => {
  assert.deepEqual(
    normalizeCrmPlanPayload(
      {
        nombre: " Premium ",
        descripcion: " Acceso completo ",
        precio: "1470",
        periodicidad: "mensual",
        duracion_dias: "30",
      },
      "9"
    ),
    {
      id_empresa: 9,
      nombre: "Premium",
      descripcion: "Acceso completo",
      precio: 1470,
      periodicidad: "mensual",
      duracion_dias: 30,
      activo: true,
    }
  );
});

test("normalizeCrmPlanPayload rechaza precios y duraciones inválidas", () => {
  assert.throws(
    () =>
      normalizeCrmPlanPayload(
        { nombre: "Básico", precio: -1, periodicidad: "mensual", duracion_dias: 30 },
        1
      ),
    /precio/
  );
  assert.throws(
    () =>
      normalizeCrmPlanPayload(
        { nombre: "Básico", precio: 10, periodicidad: "mensual", duracion_dias: 0 },
        1
      ),
    /duración/
  );
});

test("filterCrmPlans busca por nombre, descripción o periodicidad y prioriza activos", () => {
  const plans = [
    { id: 1, nombre: "Premium", descripcion: "Acceso completo", periodicidad: "mensual", activo: false },
    { id: 2, nombre: "Básico", descripcion: "Inicio", periodicidad: "quincenal", activo: true },
  ];

  assert.deepEqual(filterCrmPlans(plans).map((plan) => plan.id), [2, 1]);
  assert.deepEqual(filterCrmPlans(plans, "completo").map((plan) => plan.id), [1]);
  assert.deepEqual(filterCrmPlans(plans, "quincenal").map((plan) => plan.id), [2]);
});
