export function parseHttpsUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    throw new Error("Ingresa una URL de destino.");
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Ingresa una URL válida, por ejemplo https://instagram.com/tu_perfil.");
  }

  if (url.protocol !== "https:") {
    throw new Error("La URL debe comenzar con https://.");
  }

  if (url.username || url.password) {
    throw new Error("La URL no puede contener credenciales.");
  }

  return url.toString();
}

export function parseName(value: FormDataEntryValue | null) {
  const name = typeof value === "string" ? value.trim() : "";

  if (!name || name.length > 100) {
    throw new Error("El nombre debe tener entre 1 y 100 caracteres.");
  }

  return name;
}
