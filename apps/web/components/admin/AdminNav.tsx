"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/preguntas", label: "Preguntas" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/ligas", label: "Ligas" },
];

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Secciones del panel">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
              active ? "border-var text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {tab.label}
            {tab.href === "/admin/reportes" && openReports > 0 && (
              <span className="rounded-full bg-ko px-2 py-0.5 text-xs text-bg">{openReports}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
