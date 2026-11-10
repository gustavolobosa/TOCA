import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { buyerEmail, isLocalDevelopment } from './server';
import PaymentForm from './payment-form';

export const metadata = { title: 'Prueba de pago | TOCA', robots: { index: false, follow: false } };

export default async function TestPaymentPage() {
  if (!isLocalDevelopment((await headers()).get('host'))) notFound();
  return <main className="form-page">
    <header className="form-heading"><p>TOCA · Entorno de prueba local</p><h1>Prueba tu suscripción</h1>
      <p>$2.618 al mes, IVA incluido. Esta prueba no activa servicios en TOCA.</p></header>
    <PaymentForm buyerEmail={buyerEmail} />
  </main>;
}
