import "server-only";
import { getAccount } from "@/lib/auth";
import { CheckoutError } from "./config";

export async function checkoutAccount() {
  const account = await getAccount();
  if (!account) throw new CheckoutError("Ingresa a tu cuenta de TOCA para continuar.", 401);
  if (!account.user.email_confirmed_at || !account.profile.is_active) throw new CheckoutError("Necesitas una cuenta activa con correo confirmado.", 403);
  if (account.profile.must_change_password) throw new CheckoutError("Actualiza tu contraseña temporal en Cuenta antes de comprar.", 403);
  return account;
}
