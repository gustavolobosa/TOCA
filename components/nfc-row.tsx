"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { setNfcLinkActive } from "@/app/panel/actions";
import { CopyButton } from "@/components/copy-button";
import { DisclosureMenu } from "@/components/disclosure-menu";
import { Icon } from "@/components/icon";
import { destinationInput, destinationLabel } from "@/lib/destinations";
import type { DestinationHistory, NfcLinkSummary } from "@/lib/types";

function destinationSummary(link: NfcLinkSummary) {
  const value = destinationInput(link.destination_type, link.destination_url);
  if (link.destination_type === "instagram") return `Instagram · @${value}`;
  if (link.destination_type === "whatsapp") return `WhatsApp · +${value.replace(/^(56)(9)(\d{4})(\d{4})$/, "$1 $2 $3 $4")}`;
  try { return `${link.destination_type === "generic" ? "Enlace" : "Reseña de Google"} · ${new URL(link.destination_url).hostname}`; }
  catch { return destinationLabel(link.destination_type); }
}

function InlineHistory({ id }: { id: number }) {
  const [items, setItems] = useState<DestinationHistory[] | null>(null);
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/panel/${id}/historial`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.items)) throw new Error();
        setItems(data.items);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, attempt]);
  return <div>
    {error ? <p role="alert">No pudimos cargar el historial. <button className="text-button" type="button" onClick={() => { setError(false); setAttempt(attempt + 1); }}>Reintentar</button></p> : items === null ? <p role="status">Cargando historial…</p> : items.length ?
      <ul className="inline-history">{items.map(item => <li key={item.id}>
        <div><strong>{destinationLabel(item.destination_type)}</strong><time dateTime={item.created_at}>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(item.created_at))}</time></div>
        <p>{item.destination_url}</p>
      </li>)}</ul> : <p>Todavía no hay cambios de destino.</p>}
    <Link className="text-button" href={`/panel/${id}`}>Ver historial completo y visitas</Link>
  </div>;
}

export function NfcRow({ link, owner, tocaUrl }: { link: NfcLinkSummary & { visits: number }; owner?: string; tocaUrl: string }) {
  const [open, setOpen] = useState(false), [tab, setTab] = useState<"destination" | "history">("destination");
  const [state, toggle, pending] = useActionState(async () => {
    const result = await setNfcLinkActive(link.id, !link.is_active);
    return { ...result, success: result.error ? "" : link.is_active ? "NFC pausado." : "NFC activado." };
  }, { error: "", success: "" });
  function showHistory() { setOpen(true); setTab("history"); }
  return <article className="nfc-item" aria-label={link.name}>
    <div className="nfc-row">
      <h3 className="nfc-identity"><button type="button" aria-expanded={open} aria-controls={`nfc-detail-${link.id}`} onClick={() => setOpen(!open)}>
        <Icon name="chevron" className={open ? "expanded" : ""} /><span><span className="nfc-name">{link.name}</span>{owner && <small>{owner}</small>}</span>
      </button></h3>
      <p className="nfc-destination"><span className="mobile-label">Destino actual</span>{destinationSummary(link)}</p>
      <p className="nfc-visits"><span className="mobile-label">Visitas del período</span><span aria-label={`${link.visits} visitas en el período`}>{String(link.visits).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span></p>
      <p className={`nfc-state ${link.is_active ? "" : "is-paused"}`}>{link.is_active ? "Activo" : "Pausado"}</p>
      <div className="nfc-actions">
        <CopyButton value={tocaUrl} />
        <DisclosureMenu label={`Acciones de ${link.name}`} trigger={<Icon name="more" />}>
          <Link href={`/panel/${link.id}/editar`}>Editar</Link>
          <button type="button" onClick={showHistory}>Ver historial</button>
          <form action={toggle} className="menu-separator"><button type="submit" disabled={pending} aria-busy={pending}>
            {pending && <span className="spinner" aria-hidden="true" />}{link.is_active ? "Pausar NFC" : "Activar NFC"}
          </button></form>
        </DisclosureMenu>
      </div>
    </div>
    {link.requires_configuration && <p className="configuration-note">Configura un destino antes de activar este NFC.</p>}
    {state.error && <p className="notice error" role="alert">{state.error}</p>}
    <span className="sr-only" role="status">{pending ? "Guardando estado…" : state.success}</span>
    {open && <div className="nfc-detail" id={`nfc-detail-${link.id}`}>
      <div className="detail-navigation" role="group" aria-label={`Detalle de ${link.name}`}>
        <button type="button" aria-pressed={tab === "destination"} onClick={() => setTab("destination")}>Destino</button>
        <button type="button" aria-pressed={tab === "history"} onClick={showHistory}>Historial</button>
      </div>
      {tab === "history" ? <InlineHistory id={link.id} /> : <>
        <div className="destination-detail"><div><span className="detail-label">Destino actual</span><p>{link.destination_url}</p></div><Link className="button button-secondary" href={`/panel/${link.id}/editar`}>Editar destino</Link></div>
        <div className="stable-link"><span className="detail-label">Enlace NFC</span><p>{tocaUrl}</p></div>
        <p className="detail-total">{Number(link.total_taps)} visitas históricas en total.</p>
      </>}
    </div>}
  </article>;
}
