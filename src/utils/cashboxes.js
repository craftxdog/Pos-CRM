export function filterActiveCashboxAssignments(assignments) {
  if (!Array.isArray(assignments)) return [];

  return assignments.filter(
    (assignment) =>
      Boolean(assignment?.id_caja) &&
      assignment?.caja?.estado === "activa" &&
      Boolean(assignment.caja.descripcion?.trim()),
  );
}
