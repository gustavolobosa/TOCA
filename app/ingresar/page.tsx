import { redirect } from "next/navigation";
import Link from "next/link";
import { authReturnPath } from "@/lib/auth-return";
import { checkoutEnabled } from "@/lib/checkout/config";

import { SubmitButton } from "@/components/submit-button";
import { getAccount } from "@/lib/auth";

import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; password_changed?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ error, password_changed, next: rawNext }, account] = await Promise.all([
    searchParams,
    getAccount(),
  ]);
  const next = authReturnPath(rawNext);
  if (account?.profile.is_active) {
    redirect(next);
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
          <h2>Entra a TOCA</h2>
          <p className="muted">Ingresa con el correo y la contraseña de tu cuenta de TOCA.</p>
          {password_changed && <p className="notice success" role="status">Contraseña actualizada. Entra con tu nueva contraseña.</p>}

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <form action={signIn} className="form-stack">
            <input type="hidden" name="next" value={next} />
            <label>
              Correo
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
            <label>
              Contraseña
              <input autoComplete="current-password" maxLength={1024} name="password" required type="password" />
            </label>
            <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
          </form>
          {checkoutEnabled() && <p><Link href={`/registro?next=${encodeURIComponent(next)}`}>Crear cuenta o confirmar mi correo</Link></p>}
        </div>
      </section>
    </main>
  );
}
