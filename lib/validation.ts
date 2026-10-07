export function parseEmail(value: FormDataEntryValue | null) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresa un correo válido.");
  return email;
}

export function parsePassword(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || [...value].length < 12 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Usa una contraseña de 12 a 128 caracteres, preferiblemente una frase larga y exclusiva.");
  }
  return value;
}

export function parseId(value: number | string) {
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) throw new Error("El identificador no es válido.");
  return id;
}

export function parseUserId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Elige un usuario válido.");
  return value.toLowerCase();
}

export function parsePage(value: string | undefined) {
  if (value === undefined) return 0;
  const page = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(page) || page < 0 || page > 10000) throw new Error("La página no es válida.");
  return page;
}
