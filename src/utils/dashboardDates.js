export const ALL_DATE_RANGE = {
  fechaInicio: "1900-01-01",
  fechaFin: "9999-12-31",
};

export const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatUtcDate = (date) => date.toISOString().slice(0, 10);

export const isAllDateRange = (fechaInicio, fechaFin) =>
  fechaInicio === ALL_DATE_RANGE.fechaInicio &&
  fechaFin === ALL_DATE_RANGE.fechaFin;

export const calculatePreviousDateRange = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin || isAllDateRange(fechaInicio, fechaFin)) {
    return { fechaAnteriorInicio: null, fechaAnteriorFin: null };
  }

  const inicio = parseDateKey(fechaInicio);
  const fin = parseDateKey(fechaFin);
  if (!inicio || !fin || inicio > fin) {
    return { fechaAnteriorInicio: null, fechaAnteriorFin: null };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const rangeDays = Math.round((fin - inicio) / dayMs) + 1;
  const previousEnd = new Date(inicio.getTime() - dayMs);
  const previousStart = new Date(previousEnd.getTime() - (rangeDays - 1) * dayMs);

  return {
    fechaAnteriorInicio: formatUtcDate(previousStart),
    fechaAnteriorFin: formatUtcDate(previousEnd),
  };
};
