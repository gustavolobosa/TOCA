import { createSubscription, findSubscription, getResult, isLocalDevelopment, mp, PaymentError, verifySeller } from '../server';

export const runtime = 'nodejs';

async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isLocalDevelopment(request.headers.get('host'))) return new Response(null, { status: 404 });
  if (request.method !== 'GET' && request.headers.get('origin') !== `http://${request.headers.get('host')}`) {
    return new Response(null, { status: 403 });
  }
  let creationStarted = false;
  try {
    const attempt = new URL(request.url).searchParams.get('attempt') ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attempt)) {
      throw new PaymentError('Identificador de prueba inválido.');
    }
    await verifySeller();
    if (request.method === 'POST') {
      creationStarted = true;
      await createSubscription(attempt, `http://${request.headers.get('host')}`);
    }
    if (request.method === 'DELETE') {
      const subscription = await findSubscription(attempt);
      if (subscription && subscription.status !== 'cancelled') {
        await mp(`/preapproval/${subscription.id}`, { status: 'cancelled' }, 'PUT');
      }
    }
    return Response.json(await getResult(attempt), { headers });
  } catch (error) {
    const retryAllowed = request.method === 'POST' && error instanceof PaymentError &&
      (error.status === 400 || (!creationStarted && error.status === 403));
    return Response.json({ retryAllowed, error: error instanceof PaymentError ? error.message :
      'No se pudo confirmar el resultado. La página seguirá verificándolo automáticamente.' },
    { status: error instanceof PaymentError ? error.status : 502, headers });
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
