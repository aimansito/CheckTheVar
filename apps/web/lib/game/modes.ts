import { MODE_RULES, type GameModeSlug } from "@checkthevar/shared";

/** Modos tal y como se presentan en la web: ruta en español, textos y orden. */
export type ModeInfo = {
  slug: GameModeSlug;
  path: string;
  name: string;
  tagline: string;
  howTo: string;
  free: boolean;
  available: boolean;
};

export const MODES: ModeInfo[] = [
  {
    slug: "daily",
    path: "diario",
    name: "Reto diario",
    tagline: "10 preguntas, iguales para todos. Vuelve mañana y mantén la racha.",
    howTo: "Tienes 20 segundos por pregunta. Cuanto antes respondas, más puntos. 3 aciertos seguidos: hat-trick.",
    free: true,
    available: true,
  },
  {
    slug: "survival",
    path: "supervivencia",
    name: "Supervivencia",
    tagline: "Aguanta todo lo que puedas. Un fallo y se acaba.",
    howTo: "Preguntas sin límite, 15 segundos cada una. Al primer gol anulado, termina la partida.",
    free: false,
    available: true,
  },
  {
    slug: "time-attack",
    path: "contrarreloj",
    name: "Contrarreloj",
    tagline: "90 segundos. Todas las preguntas que puedas.",
    howTo: "10 segundos por pregunta y 90 en total. Los fallos no restan, pero gastan tiempo.",
    free: false,
    available: true,
  },
  {
    slug: "higher-lower",
    path: "mas-o-menos",
    name: "Más o menos",
    tagline: "¿Qué fichaje fue más caro? Acierta hasta que falles.",
    howTo: "Dos fichajes, una pregunta: ¿cuál costó más? Encadena aciertos; al primer fallo, se acaba.",
    free: false,
    available: true,
  },
  {
    slug: "guess-player",
    path: "adivina-el-jugador",
    name: "Adivina el jugador",
    tagline: "Pistas que se van destapando. Cuantas menos uses, más puntos.",
    howTo: "5 jugadores. Escribe su nombre (vale el apellido o el apodo). Cada pista que pides resta bonus.",
    free: false,
    available: true,
  },
  {
    slug: "career-path",
    path: "trayectoria",
    name: "Trayectoria",
    tagline: "Adivina quién es solo por la lista de clubes.",
    howTo: "5 jugadores. Cada pista es el siguiente club de su carrera. Acierta pronto para llevarte el bonus.",
    free: false,
    available: true,
  },
  {
    slug: "grid",
    path: "grid",
    name: "Grid",
    tagline: "Nombra al jugador que cumpla la fila y la columna.",
    howTo: "Próximamente.",
    free: false,
    available: false,
  },
].map((m) => ({ ...m, available: m.available && MODE_RULES[m.slug as GameModeSlug].available })) as ModeInfo[];

export const modeByPath = (path: string) => MODES.find((m) => m.path === path);
/** La jornada de liga no sale en el listado de juegos: se juega desde la liga. */
export const LEAGUE_MODE: ModeInfo = {
  slug: "league",
  path: "liga",
  name: "Jornada",
  tagline: "Las mismas 10 preguntas para toda la liga.",
  howTo: "10 preguntas de la temática de la semana. Una sola partida por jornada.",
  free: false,
  available: true,
};

export const modeBySlug = (slug: GameModeSlug) => MODES.find((m) => m.slug === slug) ?? LEAGUE_MODE;
