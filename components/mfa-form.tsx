"use client";

import { useActionState } from "react";
import { enrollMfa, verifyMfa } from "@/app/cuenta/actions";
import { ActionForm } from "@/components/action-form";

export function MfaForm({ factorId }: { factorId?: string }) {
  const [state, enroll, pending] = useActionState(() => enrollMfa({}), {});
  const currentId = factorId ?? state.factorId;
  return <>
    {!currentId && <form action={enroll}>
      <p>Usa una aplicación como Google Authenticator, Microsoft Authenticator o tu gestor de contraseñas.</p>
      <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Preparando…" : "Configurar segundo factor"}</button>
    </form>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.qr && <div className="mfa-enrollment">
      {/* El QR proviene de Auth; no se inserta como HTML ni se carga desde terceros. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Código QR para configurar el segundo factor de TOCA" width={220} height={220}
        src={state.qr.startsWith("data:image/svg+xml") ? state.qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.qr)}`} />
      <details><summary>Ingresar la clave manualmente</summary><code>{state.secret}</code></details>
      <p>Escanea el QR y luego escribe el código de seis dígitos. No compartas este QR ni la clave.</p>
    </div>}
    {currentId && <ActionForm action={verifyMfa} label="Verificar y entrar">
      <input type="hidden" name="factor_id" value={currentId} />
      <label>Código de verificación<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} name="code" required /></label>
    </ActionForm>}
  </>;
}
