import Link from "next/link";
import { requirePanelAccount } from "@/lib/auth";
import { listAttempts } from "@/lib/checkout/store";
import { plans, isPlan, pesos } from "@/lib/pricing";

export default async function PurchasesPage() {
  const { user } = await requirePanelAccount();
  const attempts = await listAttempts(user.id);
  return <main className="panel-main"><h1>Mis compras</h1><p>Últimas 50 compras. Los pagos actuales están en modo de prueba.</p>
    {!attempts.length && <p>Todavía no tienes compras.</p>}
    {attempts.map(attempt => <article className="editor-card" key={attempt.id}>
      <h2>{isPlan(attempt.plan) ? plans[attempt.plan].name : attempt.plan} · {attempt.quantity} NFC</h2>
      <p>{pesos(attempt.total_amount ?? 0)} con IVA · {attempt.fulfilled_at ? "NFC asignados" : attempt.state === "cancelled" ? "Cancelada" : attempt.state === "failed" ? "No completada" : "En proceso"}</p>
      <Link href={`/comprar/resultado/${attempt.id}`}>Ver compra y estado del pago</Link>
    </article>)}
    <p><Link href="/precios">Comprar NFC</Link> · <Link href="/panel">Ir al panel</Link></p>
  </main>;
}
