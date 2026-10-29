export function getWhatsAppUrl(message = "Hola, quiero conocer TOCA para mi comercio.") {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || "56951011687").replace(/[+\s()-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(number)) {
    throw new Error("NEXT_PUBLIC_WHATSAPP_NUMBER debe ser un número internacional válido, incluido el código de país.");
  }
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
