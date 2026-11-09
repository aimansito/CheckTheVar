import { Corners } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/layout/SiteHeader";

/** Marco común de las pantallas de registro y acceso. */
export function AuthShell({
  title,
  accent,
  subtitle,
  children,
  footer,
}: {
  title: string;
  accent: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="glow-top flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="scanlines relative overflow-hidden rounded-2xl border border-line bg-screen px-6 py-6 text-center">
            <Corners />
            <h1 className="relative font-display text-4xl uppercase leading-none">
              {title} <span className="text-var">{accent}</span>
            </h1>
            <p className="relative mt-2 text-sm text-muted">{subtitle}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">{children}</div>
          <p className="mt-4 text-center text-sm text-muted">{footer}</p>
        </div>
      </main>
    </>
  );
}
