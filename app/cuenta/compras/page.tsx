import Link from "next/link";
import { requirePanelAccount } from "@/lib/auth";
import { listAttempts } from "@/lib/checkout/store";
import { plans, isPlan, pesos } from "@/lib/pricing";

export default async function PurchasesPage() {
  const { user } = await requirePanelAccount();
  const attempts = await listAttempts(user.id);
  return <main className="panel-main"><h1>Mis compras</h1><p>Últimas 50 compras y suscripciones.</p>
    {!attempts.length && <p>Todavía no tienes compras.</p>}
    {attempts.map(attempt => <article className="editor-card" key={attempt.id}>
      <h2>{isPlan(attempt.plan) ? plans[attempt.plan].name : attempt.plan} · {attempt.quantity} NFC</h2>
      <p>{attempt.mode === "test" ? "Compra de prueba" : "Compra real"}{attempt.state === "cancelled" && " · Renovación cancelada"}</p>
      {attempt.mode === "production" && attempt.paid_until && <p>Período pagado hasta {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(attempt.paid_until))}.</p>}
      {attempt.billing_blocked && <p>Servicio suspendido por contracargo.</p>}
      <p>{pesos(attempt.total_amount ?? 0)} con IVA · {attempt.fulfilled_at ? "NFC asignados" : attempt.state === "cancelled" ? "Cancelada" : attempt.state === "failed" ? "No completada" : "En proceso"}</p>
      <Link href={`/comprar/resultado/${attempt.id}`}>Ver compra y estado del pago</Link>
    </article>)}
    <p><Link href="/precios">Comprar NFC</Link> · <Link href="/panel">Ir al panel</Link></p>
  </main>;
}
