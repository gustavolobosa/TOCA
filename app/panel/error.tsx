"use client";

export default function PanelError({ reset }: { reset: () => void }) {
  return <main className="form-page" id="main-content"><h1>No pudimos cargar el panel</h1>
    <p>Comprueba la conexión y vuelve a intentarlo. Si persiste, contacta al administrador.</p>
    <button className="button button-primary" onClick={reset} type="button">Reintentar</button></main>;
}
