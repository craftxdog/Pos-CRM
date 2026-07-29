function parseDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

export function calculateSubscriptionEnd(startDate, durationDays) {
  const start = parseDateInput(startDate);
  const duration = Number(durationDays);
  if (!start || !Number.isInteger(duration) || duration < 1) return "";

  start.setUTCDate(start.getUTCDate() + duration - 1);
  return start.toISOString().slice(0, 10);
}

