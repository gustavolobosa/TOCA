export default function UnavailableLinkPage() {
  return (
    <main className="status-page">
      <div className="tap-rings" aria-hidden="true"><span /><span /><span /></div>
      <h1>Este enlace no está disponible</h1>
      <p>El NFC puede estar pausado o la dirección ya no existe.</p>
    </main>
  );
}
