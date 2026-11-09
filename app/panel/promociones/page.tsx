import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ActionForm } from "@/components/action-form";
import { pesos } from "@/lib/pricing";
import { parsePage } from "@/lib/validation";
import { savePromotion } from "./actions";

type Promotion = {
  id: string; code: string; unit_net: number; active: boolean; expired: boolean; expires_at: string | null; max_uses: number | null;
  used: number; reserved: number; test_used: number; test_reserved: number;
};
function Fields({ promotion }: { promotion?: Promotion }) {
  const expiresOn = promotion?.expires_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.parse(promotion.expires_at) - 1)) : "";
  return <>
    <label>Código<input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" defaultValue={promotion?.code ?? ""} readOnly={Boolean(promotion)} autoComplete="off" /></label>
    <small>El nombre del código no se cambia. Para otro nombre, crea un código nuevo.</small>
    <label>Precio por NFC al mes, sin IVA (CLP)<input name="unitNet" type="number" required min={1} max={1000000} step={1} defaultValue={promotion?.unit_net ?? 1300} /></label>
    <label>Válido hasta el final del día (hora de Chile)<input name="expiresOn" type="date" defaultValue={expiresOn} /></label>
    <small>Vacío significa sin vencimiento. Solo afecta nuevas compras.</small>
    <label>Máximo total de compras<input name="maxUses" type="number" min={1} max={1000000} step={1} defaultValue={promotion?.max_uses ?? ""} /></label>
    <small>Vacío significa sin límite. Cada compra cuenta una vez, independiente de cuántos NFC incluya.</small>
    <label><input name="active" type="checkbox" defaultChecked={promotion?.active ?? true} /> Disponible para nuevas compras</label>
  </>;
}

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  let page: number;
  try { page = parsePage((await searchParams).page); } catch { notFound(); }
  const { data, error, count } = await createSupabaseServiceClient().from("checkout_promotion_summary").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 19);
  if (error) throw new Error("No pudimos cargar las promociones. Comprueba que la migración esté aplicada.");
  const promotions = data as Promotion[];
  return <main className="panel-main" id="main-content">
    <div className="panel-heading"><div><h1>Códigos promocionales</h1><p>Precio mensual por NFC para compras nuevas. Un uso por cuenta y código.</p></div></div>
    <p className="notice">El precio contratado se conserva durante todas las renovaciones. Desactivar o editar un código no modifica suscripciones existentes.</p>
    <div className="users-layout">
      <section className="editor-card"><h2>Crear código</h2>
        <ActionForm action={savePromotion.bind(null, null)} label="Crear código"><Fields /></ActionForm>
      </section>
      <section className="user-list" aria-label="Códigos existentes">
        {!promotions.length && <p>No hay códigos en esta página.</p>}
        {promotions.map(promotion => <article className="user-row" key={promotion.id}>
          <h2>{promotion.code}</h2>
          <p>{pesos(promotion.unit_net)} + IVA por NFC/mes · {pesos(Math.round(promotion.unit_net * 119 / 100))} con IVA</p>
          <p>{!promotion.active ? "Desactivado" : promotion.expired ? "Vencido" : "Activo"} · Máximo: {promotion.max_uses ?? "sin límite"}</p>
          <p>Compras reales: <strong>{promotion.used} usos consumidos</strong> · {promotion.reserved} reservados</p>
          <p className="muted">Pruebas: {promotion.test_used} consumidos · {promotion.test_reserved} reservados. No consumen cupos reales.</p>
          <details><summary>Editar precio, vigencia y disponibilidad</summary>
            <ActionForm key={`${promotion.id}-${promotion.unit_net}-${promotion.expires_at}-${promotion.max_uses}-${promotion.active}`} action={savePromotion.bind(null, promotion.id)} label="Guardar cambios">
              <Fields promotion={promotion} />
            </ActionForm>
          </details>
        </article>)}
      </section>
    </div>
    <p>Un pago aprobado consume el uso definitivamente. Cancelar o reembolsar no lo devuelve. Las reservas sin pago se revisan antes de liberarlas; no se liberan mientras exista incertidumbre sobre el cobro.</p>
    <nav className="pagination" aria-label="Páginas de promociones">
      {page > 0 && <Link href={`/panel/promociones?page=${page - 1}`}>Anterior</Link>}
      {(page + 1) * 20 < (count ?? 0) && <Link href={`/panel/promociones?page=${page + 1}`}>Siguiente</Link>}
    </nav>
  </main>;
}
