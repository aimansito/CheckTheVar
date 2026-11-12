/** Dirección pública canónica de la web (sin barra final). Se fija en NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://checkthevar.app").replace(/\/$/, "");

export const SITE_NAME = "CHECK THE VAR";
export const SITE_DESCRIPTION =
  "Quiz de fútbol gratis: reto diario, supervivencia, contrarreloj, adivina el jugador y ligas con tus amigos. Responde, pulsa CHECK THE VAR y descubre si es gol confirmado.";

/**
 * ID de Microsoft Clarity (público: aparece en el código de la página). Se puede cambiar con
 * NEXT_PUBLIC_CLARITY_ID, o dejarlo vacío para no cargar Clarity ni mostrar el aviso de cookies.
 */
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "zcpwn7sede";
