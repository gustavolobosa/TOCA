import Link from "next/link";
import { requireAccount } from "@/lib/auth";
import { signOut } from "@/app/panel/actions";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireAccount();
  return <div className="app-shell"><header className="topbar">
    <Link className="wordmark wordmark-small" href="/panel">TOCA<span className="brand-dot">.</span></Link>
    <form action={signOut}><button type="submit" className="text-button">Salir</button></form>
  </header>{children}</div>;
}
