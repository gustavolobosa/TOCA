import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="brand-mark" aria-hidden="true">T</div>
      <h1>No encontramos esta página</h1>
      <p>Revisa la dirección o vuelve al panel de TOCA.</p>
      <Link className="button button-primary" href="/panel">Ir al panel</Link>
    </main>
  );
}
