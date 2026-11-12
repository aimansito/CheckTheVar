"use client";

import { DIFFICULTY_LEVELS, DIFFICULTY_SLUGS, type DifficultyLevel } from "@checkthevar/shared";

/**
 * Selector de nivel: Normal → Histórico. Funciona dentro de un <form> (name) o controlado
 * (value + onChange). Cada nivel muestra su descripción y el multiplicador de puntos.
 */
export function DifficultyPicker({
  name,
  value,
  defaultValue,
  onChange,
  compact = false,
}: {
  name?: string;
  value?: DifficultyLevel;
  defaultValue?: DifficultyLevel;
  onChange?: (level: DifficultyLevel) => void;
  compact?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Nivel de dificultad</legend>
      {DIFFICULTY_SLUGS.map((slug, i) => {
        const d = DIFFICULTY_LEVELS[slug];
        return (
          <label
            key={slug}
            className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-line bg-surface px-4 py-3 transition hover:border-muted has-[:checked]:border-var has-[:checked]:bg-ok-bg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-var"
          >
            <input
              type="radio"
              name={name ?? "difficulty"}
              value={slug}
              className="sr-only"
              {...(value !== undefined
                ? { checked: value === slug, onChange: () => onChange?.(slug) }
                : { defaultChecked: defaultValue === slug, onChange: () => onChange?.(slug) })}
            />
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bezel font-display text-lg text-var">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl uppercase leading-none">{d.name}</span>
                <span className="text-xs font-bold text-var">×{d.multiplier.toLocaleString("es-ES")} puntos</span>
              </span>
              {!compact && <span className="mt-1 block text-sm text-muted">{d.hint}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
