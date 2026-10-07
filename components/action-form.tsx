"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/copy-button";
import type { ActionState } from "@/lib/types";

export function ActionForm({ action, label, children }: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  label: string;
  children?: React.ReactNode;
}) {
  // No reenviar secretos del recibo como "estado anterior" al Server Action.
  const [state, submit, pending] = useActionState((previous: ActionState, data: FormData) => {
    void previous;
    return action({}, data);
  }, {});
  return <form action={submit} className="form-stack">
    <fieldset disabled={pending}>{children}</fieldset>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="notice success" role="status">{state.success}</p>}
    {state.password && <div className="credential-receipt">
      <p>Guarda esta contraseña ahora. No volverá a mostrarse al salir de esta página.</p>
      {state.email && <p>{state.email}</p>}
      <label>Contraseña temporal<input autoComplete="off" readOnly type="password" value={state.password} /></label>
      <CopyButton value={state.password} />
    </div>}
    <button className="button button-primary" disabled={pending} type="submit">{pending ? "Procesando…" : label}</button>
  </form>;
}
