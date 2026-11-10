import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isLocalDevelopment } from '../../server';

export default async function CheckoutReturn({ params }: { params: Promise<{ attempt: string }> }) {
  if (!isLocalDevelopment((await headers()).get('host'))) notFound();
  const { attempt } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attempt)) notFound();
  redirect(`/prueba-pago?attempt=${attempt}`);
}
