export function parseHttpsUrl(value: FormDataEntryValue | null, siteUrl?: string) {
  if (typeof value !== "string") {
    throw new Error("Ingresa una URL de destino.");
  }

  const raw = value.trim();
  if (raw.length > 2048 || /[\u0000-\u0020\u007f]/.test(raw)) {
    throw new Error("La URL no puede contener espacios, caracteres de control ni superar 2048 caracteres.");
  }
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("Ingresa una URL válida, por ejemplo https://instagram.com/tu_perfil.");
  }

  if (url.protocol !== "https:") {
    throw new Error("La URL debe comenzar con https://.");
  }

  if (url.username || url.password) {
    throw new Error("La URL no puede contener credenciales.");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const labels = host.split(".");
  if (url.port || labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(labels.at(-1) ?? "") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) {
    throw new Error("Usa un dominio público HTTPS, sin direcciones IP ni puertos personalizados.");
  }
  if (host === "toca-one.vercel.app" || (siteUrl && host === new URL(siteUrl).hostname.toLowerCase().replace(/\.$/, ""))) {
    throw new Error("El destino no puede ser TOCA: produciría un bucle de redirecciones.");
  }
  url.hostname = host;

  return url.toString();
}

export function parseName(value: FormDataEntryValue | null) {
  const name = typeof value === "string" ? value.trim() : "";

  if (!name || name.length > 100) {
    throw new Error("El nombre debe tener entre 1 y 100 caracteres.");
  }

  return name;
}
