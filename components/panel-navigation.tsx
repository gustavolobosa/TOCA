"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";

export function PanelNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return <nav className="sidebar-nav" aria-label="Navegación principal">
    <Link href="/panel" aria-current={!pathname.startsWith("/panel/usuarios") && pathname.startsWith("/panel") ? "page" : undefined}><Icon name="chart" />Panel</Link>
    {isAdmin && <Link href="/panel/usuarios" aria-current={pathname.startsWith("/panel/usuarios") ? "page" : undefined}><Icon name="users" />Usuarios</Link>}
  </nav>;
}
