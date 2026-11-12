import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/AuthForms";
import { enabledOAuthProviders } from "@/lib/oauth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const providers = enabledOAuthProviders();
  return (
    <AuthShell
      title="Vuelve al"
      accent="vestuario"
      subtitle="Inicia sesión para seguir con tu racha."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-text underline">
            Regístrate gratis
          </Link>
        </>
      }
    >
      <Suspense fallback={<SignInForm providers={providers} />}>
        <SignInWithParams searchParams={searchParams} providers={providers} />
      </Suspense>
    </AuthShell>
  );
}

async function SignInWithParams({ searchParams, providers }: { searchParams: PageProps<"/entrar">["searchParams"]; providers: string[] }) {
  const { error, next } = await searchParams;
  return <SignInForm linkError={typeof error === "string" ? error : undefined} providers={providers} next={safeNext(next) ?? undefined} />;
}
