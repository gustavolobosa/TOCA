"use client";

import { useEffect, useRef, useState } from "react";

export function DisclosureMenu({ label, trigger, children, className = "" }: {
  label: string; trigger: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className={`disclosure-menu ${className}`} ref={container} onBlur={event => {
    // Deshabilitar una acción pendiente puede quitarle el foco sin salir del menú.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={button} type="button" className="menu-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>{trigger}</button>
    {open && <div className="menu-content">{children}</div>}
  </div>;
}
