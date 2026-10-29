const formatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export function formatDate(value: string | null) {
  return value ? formatter.format(new Date(value)) : "Todavía sin visitas";
}

export function statsStartDay(now = new Date(), days = 30) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(now);
  // Restar fechas de calendario, no horas: el cambio de hora de Chile mueve el límite.
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

export function trafficMonthPeriod(now = new Date()) {
  const today = statsStartDay(now, 1);
  const since = `${today.slice(0, 7)}-01`;
  const previousLastDay = new Date(`${since}T12:00:00Z`);
  previousLastDay.setUTCDate(0);
  const day = Number(today.slice(8));
  const comparisonDays = Math.min(day, previousLastDay.getUTCDate());
  const previousSince = `${previousLastDay.toISOString().slice(0, 7)}-01`;
  const endDay = String(comparisonDays).padStart(2, "0");
  return { today, since, previousSince,
    previousUntil: `${previousSince.slice(0, 8)}${endDay}`,
    comparisonUntil: `${since.slice(0, 8)}${endDay}`,
    dates: Array.from({ length: day }, (_, index) => `${since.slice(0, 8)}${String(index + 1).padStart(2, "0")}`) };
}
