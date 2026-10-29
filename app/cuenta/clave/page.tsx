import { requireAccount } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { changePassword } from "../actions";

export default async function PasswordPage() {
  const { profile } = await requireAccount();
  return <main className="form-page"><div className="form-heading">
    <h1>{profile.must_change_password ? "Reemplaza tu contraseña temporal" : "Cambia tu contraseña"}</h1>
    <p className="muted">Usa al menos 6 caracteres. No es obligatorio incluir números ni símbolos. Se cerrarán todas tus sesiones después del cambio.</p>
  </div><section className="editor-card">
    <ActionForm action={changePassword} label="Guardar contraseña">
      <label>Contraseña actual<input name="current_password" required type="password" autoComplete="current-password" maxLength={1024} /></label>
      <label>Nueva contraseña<input name="password" required type="password" autoComplete="new-password" minLength={6} maxLength={128} /></label>
      <label>Repite la nueva contraseña<input name="confirmation" required type="password" autoComplete="new-password" minLength={6} maxLength={128} /></label>
    </ActionForm>
  </section></main>;
}
