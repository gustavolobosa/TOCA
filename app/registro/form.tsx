"use client";
import { useActionState } from "react";
import Link from "next/link";
import { register } from "./actions";

export function RegistrationForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(register, {});
  return <>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.message && <p className="notice" role="status">{state.message}</p>}
    <form action={action} className="form-stack">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value={state.sent ? "verify" : "signup"} />
      {state.sent ? <>
        <p>Correo: {state.email}</p><input type="hidden" name="email" value={state.email} />
        <label>Código de confirmación<input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required /></label>
      </> : <>
        <label>Correo<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label>
        <p className="muted">Elige una contraseña de al menos 6 caracteres. Te enviaremos un código para verificar tu correo antes del pago.</p>
      </>}
      <button className="button button-primary" disabled={pending}>{pending ? "Procesando…" : state.sent ? "Confirmar correo y continuar" : "Crear cuenta"}</button>
    </form>
    {state.sent && <form action={action}>
      <input type="hidden" name="intent" value="resend" /><input type="hidden" name="email" value={state.email} />
      <button className="text-button" disabled={pending}>Reenviar código</button>
    </form>}
    <p><Link href={`/ingresar?next=${encodeURIComponent(next)}`}>Ya tengo cuenta: ingresar</Link></p>
  </>;
}
