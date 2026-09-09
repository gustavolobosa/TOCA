import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { getAdminEmail } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ error }, supabase] = await Promise.all([
    searchParams,
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email?.toLowerCase() === getAdminEmail()) {
    redirect("/panel");
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="Cómo funciona TOCA">
        <div className="wordmark">TOCA<span className="brand-dot">.</span></div>
        <div className="signal-demo" aria-hidden="true">
          <span className="phone-shape"><i /></span>
          <span className="signal-line signal-one" />
          <span className="signal-line signal-two" />
          <span className="signal-line signal-three" />
          <span className="destination-pill">tu destino</span>
        </div>
        <div>
          <h1>Un toque.<br />Un enlace que puedes cambiar.</h1>
          <p>Administra destinos y mide cada visita sin volver a programar el NFC.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <p className="section-kicker">Panel privado</p>
          <h2>Entra a TOCA</h2>
          <p className="muted">Usa la cuenta administradora de esta prueba.</p>

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <form action={signIn} className="form-stack">
            <label>
              Correo
              <input
                autoComplete="email"
                defaultValue={getAdminEmail()}
                name="email"
                required
                type="email"
              />
            </label>
            <label>
              Contraseña
              <input autoComplete="current-password" name="password" required type="password" />
            </label>
            <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}
