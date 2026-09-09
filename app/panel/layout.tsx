import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

import { signOut } from "./actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark wordmark-small" href="/panel">TOCA<span className="brand-dot">.</span></Link>
        <div className="topbar-actions">
          <span className="account-email">{user.email}</span>
          <form action={signOut}><button className="text-button" type="submit">Salir</button></form>
        </div>
      </header>
      {children}
    </div>
  );
}
