const DEFAULT_LOCALE = "es-NI";
const DEFAULT_TIME_ZONE = "America/Managua";

export function formatDateTime(
  value,
  { locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE } = {},
) {
  if (!value) return "Fecha no disponible";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}
