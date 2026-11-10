import 'server-only';

export const buyerEmail = 'test_user_8501473770136902242@testuser.com';
const sellerId = '3828192200';
export const amount = 2618;
const prefix = 'TOCA-LOCAL-CHECKOUT-';

export function isLocalDevelopment(host: string | null) {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL &&
    !!host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

export class PaymentError extends Error {
  constructor(message: string, public status = 400, public upstreamStatus?: number) { super(message); }
}

export async function mp<T>(path: string, body?: object, method = 'POST'): Promise<T> {
  const accessToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN;
  if (!accessToken) throw new PaymentError('Falta la credencial de prueba en .env.local.', 503);
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: body ? method : 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new PaymentError(`Mercado Pago respondió HTTP ${response.status}. Espera la verificación automática antes de repetir la prueba.`, 502, response.status);
  return response.json() as Promise<T>;
}

export async function verifySeller() {
  const seller = await mp<{ id: number; site_id: string; tags: string[] }>('/users/me');
  if (String(seller.id) !== sellerId || seller.site_id !== 'MLC' || !seller.tags.includes('test_user')) {
    throw new PaymentError('Bloqueado: la credencial no corresponde al vendedor de prueba de TOCA.', 403);
  }
}

type Subscription = {
  id: string; status: string; external_reference: string; payer_id: number; init_point: string;
  collector_id: number; auto_recurring: { transaction_amount: number; currency_id: string };
};

export async function findSubscription(attempt: string) {
  let id = subscriptions.get(attempt);
  if (!id) {
    const result = await mp<{ results: Subscription[] }>(`/preapproval/search?external_reference=${prefix}${attempt}`);
    id = result.results.find(item => item.external_reference === prefix + attempt)?.id;
  }
  const subscription = id ? await mp<Subscription>(`/preapproval/${id}`) : undefined;
  // El checkout invitado puede asignar un payer_id nuevo al mismo correo de prueba.
  if (subscription && (subscription.external_reference !== prefix + attempt || String(subscription.collector_id) !== sellerId ||
      subscription.auto_recurring.transaction_amount !== amount || subscription.auto_recurring.currency_id !== 'CLP')) {
    throw new PaymentError('La suscripción no coincide con esta prueba.', 403);
  }
  if (subscription) subscriptions.set(attempt, subscription.id);
  return subscription;
}

export async function getResult(attempt: string) {
  const subscription = await findSubscription(attempt);
  if (!subscription) return { found: false as const };
  const invoices = await mp<{ results: { payment?: { id: number } }[] }>(`/authorized_payments/search?preapproval_id=${subscription.id}`);
  const paymentId = invoices.results.find(item => item.payment?.id)?.payment?.id;
  const payment = paymentId ? await mp<{
    id: number; status: string; status_detail: string; transaction_amount: number;
    currency_id: string; external_reference: string; collector_id: number; payer: { email: string };
  }>(`/v1/payments/${paymentId}`) : undefined;
  if (payment && (payment.external_reference !== prefix + attempt || String(payment.collector_id) !== sellerId ||
      payment.transaction_amount !== amount || payment.currency_id !== 'CLP' || payment.payer.email !== buyerEmail)) {
    throw new PaymentError('El pago no coincide con esta prueba.', 403);
  }
  return {
    found: true as const, checkoutUrl: subscription.status === 'pending' ? checkoutUrl(subscription) : undefined, subscriptionId: subscription.id, subscriptionStatus: subscription.status,
    paymentId: payment?.id, paymentStatus: payment?.status ?? 'pending', paymentDetail: payment?.status_detail,
  };
}

function checkoutUrl(subscription: Subscription) {
  const url = new URL(subscription.init_point);
  if (url.origin !== 'https://www.mercadopago.cl' || url.pathname !== '/subscriptions/checkout' ||
      url.searchParams.get('preapproval_id') !== subscription.id) {
    throw new PaymentError('Mercado Pago devolvió una dirección de checkout inesperada.', 502);
  }
  return url.href;
}

// shortcut: bloqueo en memoria para un servidor local; una integración pública requiere persistencia duradera.
const local = globalThis as typeof globalThis & {
  tocaCheckoutAttempts?: Map<string, Promise<void>>; tocaCheckoutSubscriptions?: Map<string, string>;
};
const attempts = local.tocaCheckoutAttempts ??= new Map();
const subscriptions = local.tocaCheckoutSubscriptions ??= new Map();

export async function createSubscription(attempt: string, origin: string) {
  if (attempts.has(attempt)) return attempts.get(attempt);
  const operation = (async () => {
    if (await findSubscription(attempt)) return;
    const created = await mp<Subscription>('/preapproval', {
      reason: 'TOCA - Prueba checkout mensual (IVA incluido)', external_reference: prefix + attempt,
      payer_email: buyerEmail, status: 'pending',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: amount, currency_id: 'CLP' },
      back_url: `${origin}/prueba-pago/retorno/${attempt}`,
    }).catch((error: unknown) => {
      if (error instanceof PaymentError && error.upstreamStatus === 400) {
        throw new PaymentError('Mercado Pago rechazó la creación del checkout de prueba.');
      }
      throw error;
    });
    subscriptions.set(attempt, created.id);
  })();
  attempts.set(attempt, operation);
  return operation;
}
