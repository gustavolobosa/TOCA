const formatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export function formatDate(value: string | null) {
  return value ? formatter.format(new Date(value)) : "Todavía sin visitas";
}

export function statsStartDay(now = new Date()) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(now);
  // Restar fechas de calendario, no horas: el cambio de hora de Chile mueve el límite.
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return start.toISOString().slice(0, 10);
}
