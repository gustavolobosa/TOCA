import { ActionForm } from "@/components/action-form";
import { getProfiles } from "@/lib/data";
import { createUser, setUserActive } from "./actions";

export default async function UsersPage() {
  const profiles = await getProfiles();
  return <main className="panel-main" id="main-content">
    <div className="panel-heading"><div><h1>Usuarios</h1><p className="muted">Solo tú creas las cuentas y asignas sus NFC.</p></div></div>
    <div className="users-layout">
      <section className="editor-card"><h2>Crear usuario</h2>
        <ActionForm action={createUser} label="Crear usuario">
          <label>Nombre<input name="name" required maxLength={100} autoComplete="name" /></label>
          <label>Correo<input name="email" required type="email" maxLength={254} autoComplete="email" /></label>
          <small>Se generará una contraseña temporal individual. No se enviará un correo.</small>
        </ActionForm>
      </section>
      <section aria-label="Cuentas existentes" className="user-list">
        {profiles.map(profile => <article className="user-row" key={profile.id}>
          <h2>{profile.name}</h2><p className="muted">{profile.email}</p>
          <p>{profile.is_admin ? "Administrador" : profile.is_active ? "Cuenta activa" : "Cuenta desactivada"}
            {profile.must_change_password ? ". Cambio de contraseña pendiente." : ""}</p>
          {!profile.is_admin && <>
            <p className="muted">{profile.is_active ? "Desactivar bloqueará el panel y pausará todos sus NFC." : "Reactivar permite entrar al panel; sus NFC siguen pausados."}</p>
            <ActionForm action={setUserActive.bind(null, profile.id, !profile.is_active)} label={profile.is_active ? "Desactivar cuenta" : "Reactivar cuenta"} />
          </>}
        </article>)}
      </section>
    </div>
  </main>;
}
