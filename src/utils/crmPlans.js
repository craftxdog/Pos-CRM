export const CRM_PLAN_PERIODICITIES = [
  "diario",
  "semanal",
  "quincenal",
  "mensual",
  "trimestral",
  "anual",
];

export const CRM_PLAN_DAYS = {
  diario: 1,
  semanal: 7,
  quincenal: 15,
  mensual: 30,
  trimestral: 90,
  anual: 365,
};

export function normalizeCrmPlanPayload(values, idEmpresa) {
  const nombre = String(values.nombre || "").trim();
  const descripcion = String(values.descripcion || "").trim();
  const precio = Number(values.precio);
  const duracionDias = Number(values.duracion_dias);
  const periodicidad = String(values.periodicidad || "mensual");

  if (!nombre) throw new Error("Escribe el nombre del plan");
  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error("El precio debe ser un número igual o mayor que cero");
  }
  if (!Number.isInteger(duracionDias) || duracionDias < 1) {
    throw new Error("La duración debe ser de al menos un día");
  }
  if (!CRM_PLAN_PERIODICITIES.includes(periodicidad)) {
    throw new Error("Selecciona una periodicidad válida");
  }

  return {
    id_empresa: Number(idEmpresa),
    nombre,
    descripcion: descripcion || null,
    precio,
    periodicidad,
    duracion_dias: duracionDias,
    activo: values.activo !== false,
  };
}

export function filterCrmPlans(plans, search = "") {
  const term = String(search || "").trim().toLocaleLowerCase("es");
  const ordered = [...(plans || [])].sort(
    (a, b) =>
      Number(Boolean(b.activo)) - Number(Boolean(a.activo)) ||
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
  );

  if (!term) return ordered;

  return ordered.filter((plan) =>
    [plan.nombre, plan.descripcion, plan.periodicidad]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("es").includes(term))
  );
}
