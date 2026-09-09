const formatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export function formatDate(value: string | null) {
  return value ? formatter.format(new Date(value)) : "Todavía sin visitas";
}
