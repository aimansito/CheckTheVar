import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/AuthForms";
import { enabledOAuthProviders } from "@/lib/oauth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const providers = enabledOAuthProviders();
  return (
    <AuthShell
      title="Ficha por"
      accent="CHECK THE VAR"
      subtitle="Gratis. Guarda tus puntos, mantén la racha y compite en ligas con tus amigos."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="font-semibold text-text underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <Suspense fallback={<SignUpForm providers={providers} />}>
        <WithNext searchParams={searchParams} providers={providers} />
      </Suspense>
    </AuthShell>
  );
}

async function WithNext({ searchParams, providers }: { searchParams: PageProps<"/registro">["searchParams"]; providers: string[] }) {
  const { next } = await searchParams;
  return <SignUpForm providers={providers} next={safeNext(next) ?? undefined} />;
}
