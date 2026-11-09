import { timingSafeEqual } from "node:crypto";
import { checkoutStatus } from "@/lib/checkout/mercadopago";
import { markReconciliation, purchaseFromAttempt, reconciliationBatch } from "@/lib/checkout/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new Response(null, { status: 401 });
  try {
    const batch = await reconciliationBatch();
    const results = await Promise.allSettled(batch.map(async attempt => {
      // Rotar también los fallos evita que una compra bloquee indefinidamente las siguientes.
      await markReconciliation(attempt.id);
      await checkoutStatus(purchaseFromAttempt(attempt));
    }));
    const failed = results.filter(result => result.status === "rejected").length;
    if (failed) console.error("checkout_reconciliation_failed", { failed, checked: batch.length });
    return Response.json({ checked: batch.length, failed }, { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No se pudo revisar el lote de compras." }, { status: 503 });
  }
}
