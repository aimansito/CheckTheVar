"use client";

import { useActionState, useState } from "react";
import type { DifficultyLevel } from "@checkthevar/shared";
import { Alerts, Field } from "@/components/auth/AuthForms";
import { DifficultyPicker } from "@/components/game/DifficultyPicker";
import { createLeague, joinLeague, updateDifficulty, type FormState } from "@/lib/league-actions";

const submit = "w-full rounded-xl bg-var py-3.5 font-bold text-bg transition hover:brightness-110 disabled:opacity-60";

export function CreateLeagueForm({ defaultDifficulty }: { defaultDifficulty: DifficultyLevel }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createLeague, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alerts state={state} />
      <Field label="Nombre de la liga" name="name" error={fe.name} placeholder="Los del grupo del fútbol" hint="Entre 3 y 40 caracteres." />
      <fieldset>
        <legend className="text-sm font-semibold">Formato</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <FormatOption value="points" title="Por puntos" text="Todos suman sus puntos de cada jornada." defaultChecked />
          <FormatOption value="head_to_head" title="1 contra 1" text="Un rival cada semana: victoria 3, empate 1." />
        </div>
      </fieldset>
      <div>
        <p className="text-sm font-semibold">Nivel de la liga</p>
        <p className="mb-2 mt-0.5 text-xs text-muted">Todos responden las mismas preguntas de este nivel.</p>
        <DifficultyPicker name="difficulty" defaultValue={defaultDifficulty} compact />
      </div>
      <button disabled={pending} className={submit}>
        {pending ? "Creando…" : "Crear liga"}
      </button>
    </form>
  );
}

function FormatOption({ value, title, text, defaultChecked }: { value: string; title: string; text: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-line bg-bg p-4 transition hover:border-muted has-[:checked]:border-var has-[:checked]:bg-ok-bg">
      <input type="radio" name="format" value={value} defaultChecked={defaultChecked} className="sr-only" />
      <span className="font-display text-xl uppercase leading-none">{title}</span>
      <span className="text-sm text-muted">{text}</span>
    </label>
  );
}

export function JoinLeagueForm({ defaultCode }: { defaultCode?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinLeague, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3" noValidate>
      <Alerts state={state} />
      <label className="block text-sm font-semibold" htmlFor="code">
        Código de invitación
      </label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          maxLength={6}
          defaultValue={defaultCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABC234"
          aria-invalid={Boolean(fe.code)}
          className={`min-w-0 flex-1 rounded-xl border bg-bg px-4 py-3 font-display text-2xl uppercase tracking-[0.25em] outline-none transition focus:border-var ${fe.code ? "border-ko" : "border-line"}`}
        />
        <button disabled={pending} className="rounded-xl bg-var px-5 font-bold text-bg hover:brightness-110 disabled:opacity-60">
          {pending ? "…" : "Unirme"}
        </button>
      </div>
      {fe.code && <p className="text-xs text-ko">{fe.code}</p>}
    </form>
  );
}

/** Código + enlace de invitación, con copiar y compartir. */
export function InviteShare({ code, leagueName }: { code: string; leagueName: string }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = () => `${window.location.origin}/ligas/unirse/${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* el navegador no deja copiar: el código sigue visible */
    }
  };
  const share = async () => {
    if (!("share" in navigator)) return copy();
    try {
      await navigator.share({ title: leagueName, text: `Únete a mi liga "${leagueName}" en CHECK THE VAR. Código: ${code}`, url: inviteUrl() });
    } catch {
      /* cancelado */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-lg bg-screen px-3 py-1.5 font-display text-2xl tracking-[0.25em] text-var">{code}</span>
      <button type="button" onClick={copy} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold hover:border-var">
        {copied ? "Enlace copiado ✓" : "Copiar enlace"}
      </button>
      <button type="button" onClick={share} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold hover:border-var">
        Compartir
      </button>
    </div>
  );
}

export function DifficultyForm({ current }: { current: DifficultyLevel }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateDifficulty, {});
  return (
    <form action={action} className="space-y-3">
      <Alerts state={state} />
      <DifficultyPicker name="difficulty" defaultValue={current} />
      <button disabled={pending} className="rounded-xl border border-line bg-surface px-6 py-3 font-bold hover:border-var disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar nivel"}
      </button>
    </form>
  );
}
