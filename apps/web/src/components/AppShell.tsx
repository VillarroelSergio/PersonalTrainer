"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { describeSync } from "@/lib/offline/sync-description";

const NAV_DESTINATIONS = [
  { href: "/hoy", label: "Inicio", icon: <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /> },
  { href: "/plan", label: "Plan", icon: <path d="M4 5h16v15H4V5zm0 5h16M8 3v4m8-4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> },
  { href: "/ejercicios", label: "Ejercicios", icon: <path d="M4 5h5a3 3 0 013 3v11a2.5 2.5 0 00-2.5-2.5H4V5zm16 0h-5a3 3 0 00-3 3v11a2.5 2.5 0 012.5-2.5H20V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /> },
  { href: "/historial", label: "Historial", icon: <path d="M12 8v5l3 2M21 12a9 9 0 11-3-6.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> }
];

export function AppShell({ backHref, children }: { title: string; backHref?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("trainer-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("trainer-theme", next);
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__brand">
          {backHref ? (
            <Link href={backHref} className="icon-btn" aria-label="Volver">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          ) : null}
          <span className="topbar__mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 12h2m12 0h2M8 7v10m8-10v10M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </span>
          <span className="topbar__title">Tu camino</span>
        </div>
        <div className="topbar__tools">
          <SyncIndicator />
          <Link href="/perfil" className="icon-btn" aria-label="Perfil">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" /><path d="M5 20c1.5-4 4.2-6 7-6s5.5 2 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </Link>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} aria-pressed={theme === "light"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5l-1.4 1.4M7.9 16.1l-1.4 1.4m0-11l1.4 1.4M16.1 16.1l1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>

      <InitialSyncNotice />

      <main id="mainContent">{children}</main>

      {!backHref ? (
        <nav className="bottomnav" aria-label="Navegación principal">
          {NAV_DESTINATIONS.map((item) => (
            <Link key={item.href} href={item.href} className="bottomnav__btn" aria-current={pathname === item.href ? "page" : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">{item.icon}</svg>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}

function InitialSyncNotice() {
  const { status } = useOfflineData();
  if (status !== "needs-initial-sync") return null;
  const description = describeSync({ state: "sincronizado", pending: 0, conflicts: [], snapshotStatus: status });
  return (
    <p className="notice notice--warn" role="status">
      {description.title}: {description.body}
    </p>
  );
}

function SyncIndicator() {
  const sync = useOfflineSyncContext();
  const offlineData = useOfflineData();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const description = describeSync({ state: sync.state, pending: sync.pending, conflicts: sync.conflicts, snapshotStatus: offlineData.status });

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className="sync-pill" onClick={() => setOpen(true)} aria-label={description.ariaLabel}>
        <span className="sync-dot" data-state={sync.state} aria-hidden="true" />
        <span className="sync-pill__icon" aria-hidden="true">{description.icon}</span>
      </button>

      {open ? (
        <div className="sheet-overlay" role="presentation" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="syncSheetTitle" onClick={(event) => event.stopPropagation()}>
            <div className="sheet__header">
              <h2 id="syncSheetTitle">{description.title}</h2>
            </div>
            <div className="sheet__body">
              <p className="lede small">{description.body}</p>

              {description.conflicts.length > 0 ? (
                <>
                  <p className="notice notice--warn" role="alert">Elige con calma: nada se descarta hasta que pulses una opción.</p>
                  {description.conflicts.map((conflict) => (
                    <div key={conflict.id} className="sync-conflict">
                      <p className="sync-conflict__copy">
                        <strong>{conflict.entity}</strong>
                        <span>{conflict.detail}</span>
                      </p>
                      {conflict.keepLocalLabel ? (
                        <button type="button" className="btn btn--primary btn--block" onClick={() => sync.resolveKeepLocal(conflict.id)}>{conflict.keepLocalLabel}</button>
                      ) : null}
                      <button type="button" className="btn btn--ghost btn--block" onClick={() => sync.resolveKeepServer(conflict.id)}>{conflict.keepServerLabel}</button>
                    </div>
                  ))}
                </>
              ) : null}

              {description.canRetry ? (
                <button type="button" className="btn btn--ghost btn--block" onClick={() => sync.flush()}>Reintentar ahora</button>
              ) : null}

              <button type="button" className="btn btn--ghost btn--block" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
