export function Icon({ name, className = "" }: { name: "chart" | "users" | "chevron" | "more" | "copy" | "info"; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "chart" && <><path d="M5 20V11M12 20V4M19 20V8" /></>}
    {name === "users" && <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
    {name === "chevron" && <path d="m9 5 7 7-7 7" />}
    {name === "more" && <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>}
    {name === "copy" && <><rect x="8" y="7" width="12" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" /></>}
    {name === "info" && <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>}
  </svg>;
}
