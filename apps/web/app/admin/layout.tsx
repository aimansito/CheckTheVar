import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/brand/Logo";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel CHECK THE VAR" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size="header" />
            <span className="hidden rounded-md bg-var px-2 py-1 font-display text-sm uppercase tracking-wide text-bg sm:inline">Panel</span>
          </div>
          <Suspense fallback={null}>
            <AdminBadge />
          </Suspense>
        </div>
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          <Suspense fallback={<div className="h-11" aria-hidden />}>
            <NavWithCounts />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}

async function AdminBadge() {
  const admin = await requireAdmin();
  return (
    <div className="flex items-center gap-4 text-sm font-semibold">
      <span className="hidden text-muted sm:inline">@{admin.username}</span>
      <Link href="/" className="rounded-lg border border-line px-3 py-2 hover:border-var">
        Ver la web
      </Link>
    </div>
  );
}

async function NavWithCounts() {
  await requireAdmin();
  const { count } = await getSupabaseAdmin()
    .from("question_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return <AdminNav openReports={count ?? 0} />;
}
