"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function VisitsRealtime({ nfcId }: { nfcId?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disconnected, setDisconnected] = useState(false);
  const finishRefresh = useRef<(() => void) | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let disposed = false;
    let dirty = false;
    let refreshing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleRefresh() {
      if (disposed || !dirty || refreshing || timer !== undefined ||
          document.visibilityState !== "visible" || !navigator.onLine) return;
      // Agrupa ráfagas sin postergar indefinidamente la actualización.
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed || document.visibilityState !== "visible" || !navigator.onLine) return;
        dirty = false;
        refreshing = true;
        // shortcut: reutiliza las consultas del panel; optimizar agregaciones si aumenta el tráfico.
        startTransition(() => router.refresh());
      }, 750);
    }

    function requestRefresh() {
      dirty = true;
      scheduleRefresh();
    }

    finishRefresh.current = () => {
      refreshing = false;
      scheduleRefresh();
    };

    const channel = supabase.channel(`visits:${nfcId ?? "panel"}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "redirect_events",
        select: ["id", "nfc_link_id"],
        ...(nfcId === undefined ? {} : { filter: `nfc_link_id=eq.${nfcId}` }),
      }, requestRefresh)
      .subscribe(status => {
        if (disposed) return;
        setDisconnected(status !== "SUBSCRIBED");
        // Cierra la ventana entre la carga inicial y la suscripción, y recupera visitas tras reconectar.
        if (status === "SUBSCRIBED") requestRefresh();
      });

    document.addEventListener("visibilitychange", requestRefresh);
    window.addEventListener("online", requestRefresh);
    return () => {
      disposed = true;
      finishRefresh.current = null;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", requestRefresh);
      window.removeEventListener("online", requestRefresh);
      void supabase.removeChannel(channel);
    };
  }, [nfcId, router, startTransition]);

  useEffect(() => {
    if (!isPending) finishRefresh.current?.();
  }, [isPending]);

  return disconnected ? <p className="muted" role="status">
    La actualización en vivo está desconectada. Estamos intentando reconectar.
  </p> : null;
}
