import type { DestinationType, EventDestinationType } from "./types.ts";
import { parseHttpsUrl } from "./urls.ts";

export const destinationOptions = [
  { value: "instagram", label: "Instagram", field: "Usuario de Instagram", placeholder: "@tu_negocio", hint: "Solo el nombre de usuario, sin pegar el enlace." },
  { value: "whatsapp", label: "WhatsApp", field: "Número de WhatsApp", placeholder: "+56 9 1234 5678", hint: "Incluye el código de país. TOCA abrirá la conversación, sin enviar un mensaje." },
  { value: "google_review", label: "Reseña de Google", field: "Enlace para solicitar reseñas", placeholder: "https://g.page/r/…/review", hint: "Cópialo desde tu Perfil de Empresa: Leer reseñas → Conseguir más reseñas." },
  { value: "generic", label: "Enlace genérico", field: "URL de destino", placeholder: "https://tu-sitio.cl", hint: "Una dirección pública que comience con https://." },
] as const;

export function destinationLabel(type: EventDestinationType) {
  return destinationOptions.find(option => option.value === type)?.label ?? "Sin clasificar";
}

export function parseDestination(type: FormDataEntryValue | null, value: FormDataEntryValue | null, siteUrl?: string): { destination_type: DestinationType; destination_url: string } {
  if (!destinationOptions.some(option => option.value === type) || typeof value !== "string") {
    throw new Error("Elige un tipo de destino y completa su campo.");
  }
  const input = value.trim();
  if (type === "instagram") {
    const username = input.replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(username) || username.includes("..")) {
      throw new Error("Ingresa un usuario de Instagram válido: hasta 30 letras, números, puntos o guiones bajos.");
    }
    return { destination_type: type, destination_url: `https://www.instagram.com/${username}/` };
  }
  if (type === "whatsapp") {
    const number = input.replace(/[\s()+.-]/g, "");
    if (!/^\+?[\d\s().-]+$/.test(input) || !/^[1-9]\d{7,14}$/.test(number)) {
      throw new Error("Ingresa un número internacional de 8 a 15 dígitos, con código de país.");
    }
    return { destination_type: type, destination_url: `https://wa.me/${number}` };
  }
  const destinationUrl = parseHttpsUrl(input, siteUrl);
  if (type === "google_review") {
    const url = new URL(destinationUrl);
    const validShort = url.hostname === "g.page" && /^\/(?:r\/)?[a-zA-Z0-9_-]+\/review\/?$/.test(url.pathname);
    const validPlace = url.hostname === "search.google.com" && url.pathname === "/local/writereview" && /^[a-zA-Z0-9_-]{5,256}$/.test(url.searchParams.get("placeid") ?? "");
    if ((!validShort && !validPlace) || url.hash) {
      throw new Error("Pega el enlace oficial para solicitar reseñas (g.page/…/review), no el enlace general de Google Maps.");
    }
  }
  return { destination_type: type as DestinationType, destination_url: destinationUrl };
}

export function destinationInput(type: DestinationType, value: string) {
  try {
    const url = new URL(value);
    if (type === "instagram" || type === "whatsapp") return url.pathname.split("/")[1] ?? "";
  } catch { /* Un destino heredado inválido se muestra completo para corregirlo. */ }
  return value;
}
