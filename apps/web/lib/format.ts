import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@checkthevar/shared";

/** "lun 16 nov, 0:00" en hora de España (las jornadas cierran el lunes a medianoche). */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const levelLabel = (d: string | null | undefined) =>
  d && d in DIFFICULTY_LEVELS ? `Nivel ${DIFFICULTY_LEVELS[d as DifficultyLevel].name}` : "";
