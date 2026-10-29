import Link from "next/link";
import styles from "@/app/page.module.css";

export function PublicHeader({ current }: { current?: "precios" }) {
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className={styles.header}>
      <Link className={styles.wordmark} href="/" aria-label="TOCA, inicio">TOCA</Link>
      <nav aria-label="Navegación principal">
        <Link href="/#como-funciona">Cómo funciona</Link>
        <Link href="/precios" aria-current={current === "precios" ? "page" : undefined}>Precios</Link>
        <Link href="/ingresar" prefetch={false}>Ingresar</Link>
      </nav>
    </header>
  </>;
}

export function PublicFooter() {
  return <footer className={styles.footer}>
    <Link href="/" className={styles.wordmark} aria-label="TOCA, inicio">TOCA</Link>
    <span>Conecta. Cambia. Mide.</span>
  </footer>;
}
