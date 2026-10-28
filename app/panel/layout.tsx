import Link from "next/link";

import { requirePanelAccount } from "@/lib/auth";

import { signOut } from "./actions";
import { PanelNavigation } from "@/components/panel-navigation";
import { DisclosureMenu } from "@/components/disclosure-menu";
import { Icon } from "@/components/icon";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = await requirePanelAccount();
  const initials = profile.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  return (
    <div className="app-shell panel-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <aside className="sidebar">
        <Link className="wordmark wordmark-small" href="/panel">TOCA</Link>
        <PanelNavigation isAdmin={isAdmin} />
        <DisclosureMenu className="account-menu" label="Abrir menú de cuenta" trigger={<><span className="avatar">{initials}</span><span className="account-name">{profile.name}</span><Icon name="chevron" /></>}>
          <Link href="/cuenta/clave">Mi cuenta</Link>
          <form action={signOut}><button type="submit">Salir</button></form>
        </DisclosureMenu>
      </aside>
      {children}
    </div>
  );
}
