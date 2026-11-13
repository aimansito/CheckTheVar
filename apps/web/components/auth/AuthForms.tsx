"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DifficultyPicker } from "@/components/game/DifficultyPicker";
import { requestPasswordReset, resendConfirmation, signIn, signInWithProvider, signUp, updatePassword } from "@/lib/auth-actions";

const input =
  "mt-1.5 block w-full rounded-xl border border-line bg-bg px-4 py-3 text-base outline-none transition focus:border-var";

export function Field({
  label,
  name,
  type = "text",
  error,
  defaultValue,
  autoComplete,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`${input} ${error ? "border-ko" : ""}`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-ko">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
      )}
    </label>
  );
}

export function Alerts({ state }: { state: { error?: string; info?: string } }) {
  return (
    <>
      {state.error && <p className="rounded-xl border border-ko bg-ko-bg px-4 py-3 text-sm">{state.error}</p>}
      {state.info && <p className="rounded-xl border border-var bg-ok-bg px-4 py-3 text-sm">{state.info}</p>}
    </>
  );
}

const submit = "w-full rounded-xl bg-var py-3.5 font-bold text-bg transition hover:brightness-110 disabled:opacity-60";

/** Botones de Google / Apple. Solo se muestran los proveedores configurados (NEXT_PUBLIC_OAUTH_PROVIDERS). */
export function OAuthButtons({ providers }: { providers: string[] }) {
  if (!providers.length) return null;
  const names: Record<string, string> = { google: "Google", apple: "Apple" };
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <form key={p} action={signInWithProvider}>
          <input type="hidden" name="provider" value={p} />
          <button className="w-full rounded-xl border border-line bg-bg py-3 font-bold transition hover:border-var">Continuar con {names[p] ?? p}</button>
        </form>
      ))}
      <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />o con tu email<span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export function SignUpForm({ providers = [], next }: { providers?: string[]; next?: string }) {
  const [state, action, pending] = useActionState(signUp, {});
  const fe = state.fieldErrors ?? {};
  if (state.sent) return <AccountCreated email={state.sent} />;
  return (
    <div className="space-y-4">
      <OAuthButtons providers={providers} />
      <form action={action} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Alerts state={state} />
        <Field label="Nombre de jugador" name="username" error={fe.username} defaultValue={state.values?.username} autoComplete="username" hint="Así te verán en las ligas. Letras, números y _" />
        <Field label="Email" name="email" type="email" error={fe.email} defaultValue={state.values?.email} autoComplete="email" />
        <Field label="Contraseña" name="password" type="password" error={fe.password} autoComplete="new-password" hint="Mínimo 8 caracteres" />
        <div>
          <p className="text-sm font-semibold">¿Cuánto sabes de fútbol?</p>
          <p className="mb-2 mt-0.5 text-xs text-muted">Lo puedes cambiar antes de cada partida y en tu perfil.</p>
          <DifficultyPicker name="difficulty" defaultValue="aficionado" />
          {fe.difficulty && <span className="mt-1 block text-xs text-ko">{fe.difficulty}</span>}
        </div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input name="acceptTerms" type="checkbox" className="mt-0.5 h-5 w-5 accent-var" />
          <span>
            Tengo al menos 14 años y acepto la{" "}
            <Link href="/legal/privacidad" target="_blank" className="text-text underline">
              política de privacidad
            </Link>
            .{fe.acceptTerms && <span className="block text-xs text-ko">{fe.acceptTerms}</span>}
          </span>
        </label>
        <button disabled={pending} className={submit}>
          {pending ? "Creando cuenta…" : "Crear cuenta gratis"}
        </button>
      </form>
    </div>
  );
}

/** Sustituye al formulario de registro cuando la cuenta se ha creado y falta confirmar el email. */
function AccountCreated({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, {});
  return (
    <div className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-bg text-var" aria-hidden>
        <svg viewBox="0 0 64 64" className="h-9 w-9">
          <path d="M14 33.5 27 46 50 20" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="mt-5 font-display text-4xl uppercase leading-none">Gol confirmado</p>
      <p className="mt-2 font-semibold">Tu cuenta se ha creado correctamente.</p>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Te hemos enviado un correo a <span className="font-semibold text-text">{email}</span>. Pulsa el enlace del
        correo para activar la cuenta y empezar a jugar.
      </p>
      <p className="mt-2 text-xs text-muted">¿No lo ves? Mira en la carpeta de spam o promociones.</p>

      <form action={action} className="mt-6 space-y-3">
        <input type="hidden" name="email" value={email} />
        <Alerts state={state} />
        <button
          disabled={pending}
          className="w-full rounded-xl border border-line bg-bg py-3.5 font-bold transition hover:border-var disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Reenviar el correo"}
        </button>
      </form>
      <Link href="/jugar/diario" className="mt-3 block text-sm font-semibold text-muted underline hover:text-text">
        Mientras tanto, juega el reto de hoy
      </Link>
    </div>
  );
}

const LINK_ERRORS: Record<string, string> = {
  enlace: "El enlace no es válido o ha caducado. Inicia sesión o pide uno nuevo.",
  proveedor: "No se pudo entrar con ese proveedor. Prueba con tu email o inténtalo más tarde.",
};

export function SignInForm({ linkError, providers = [], next }: { linkError?: string; providers?: string[]; next?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  const fe = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      <OAuthButtons providers={providers} />
      <form action={action} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {linkError && !state.error && LINK_ERRORS[linkError] && (
          <p className="rounded-xl border border-ko bg-ko-bg px-4 py-3 text-sm">{LINK_ERRORS[linkError]}</p>
        )}
        <Alerts state={state} />
        <Field label="Email" name="email" type="email" error={fe.email} defaultValue={state.values?.email} autoComplete="email" />
        <Field label="Contraseña" name="password" type="password" error={fe.password} autoComplete="current-password" />
        <button disabled={pending} className={submit}>
          {pending ? "Entrando…" : "Iniciar sesión"}
        </button>
        <p className="text-center text-sm">
          <Link href="/recuperar" className="text-muted underline-offset-2 hover:text-text hover:underline">
            ¿Has olvidado la contraseña?
          </Link>
        </p>
      </form>
    </div>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alerts state={state} />
      {!state.info && (
        <>
          <Field label="Email de tu cuenta" name="email" type="email" error={fe.email} defaultValue={state.values?.email} autoComplete="email" />
          <button disabled={pending} className={submit}>
            {pending ? "Enviando…" : "Enviarme el enlace"}
          </button>
        </>
      )}
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alerts state={state} />
      <Field label="Nueva contraseña" name="password" type="password" error={fe.password} autoComplete="new-password" hint="Mínimo 8 caracteres" />
      <Field label="Repite la contraseña" name="confirm" type="password" error={fe.confirm} autoComplete="new-password" />
      <button disabled={pending} className={submit}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
