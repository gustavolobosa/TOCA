import Link from "next/link";

import { requirePanelAccount } from "@/lib/auth";

import { signOut } from "./actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await requirePanelAccount();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark wordmark-small" href="/panel">TOCA<span className="brand-dot">.</span></Link>
        <div className="topbar-actions">
          <nav aria-label="Navegación principal"><Link href="/panel">NFC</Link>{isAdmin && <Link href="/panel/usuarios">Usuarios</Link>}<Link href="/cuenta/clave">Mi cuenta</Link></nav>
          <span className="account-email">{user.email}</span>
          <form action={signOut}><button className="text-button" type="submit">Salir</button></form>
        </div>
      </header>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      {children}
    </div>
  );
}
