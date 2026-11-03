# Guion: vídeos de quiz de fútbol para TikTok con Claude

Formato base: **pregunta → cuenta atrás → CHECK THE VAR → respuesta correcta → llamada a jugar**.
Duración: unos 15 segundos. Vertical 9:16 (1080 × 1920).

---

## 1. El guion de cada vídeo, segundo a segundo

| Tiempo | En pantalla | Sonido | Objetivo |
|---|---|---|---|
| 0,0–1,5 s | Gancho grande: "¿Lo sabes?", "Miércoles de Champions", "Solo para expertos" | Golpe seco | Frenar el scroll |
| 1,5–3,5 s | La pregunta y las opciones A, B, C entrando una a una | Whoosh suave | Que se entienda en 2 s |
| 3,5–8,5 s | Cuenta atrás 5 → 1 con barra que se vacía | Tic por segundo | Que la gente piense (y comente) |
| 8,5–10 s | Se pulsa **CHECK THE VAR** → "Revisando la jugada…" | Pitido de árbitro / zumbido | Suspense: es tu marca |
| 10–13 s | Opción correcta en verde + **GOL CONFIRMADO** + dato curioso | Grada celebrando | Recompensa |
| 13–15 s | Logo + "¿Acertaste? Juega el reto de hoy" + dominio | Cierre | Llevar tráfico a la web |

**Texto del pie del vídeo (plantilla):**
> ¿Lo sabías? Dímelo en comentarios ⬇️ Reto diario en checkthevar.es
> #futbol #quizfutbol #checkthevar #champions #laliga #mundial

**Comentario fijado:** "¿Qué respondiste? A, B o C 👇". Los comentarios son lo que más mueve el algoritmo.

---

## 2. Paso 1 — Generar las preguntas con Claude

Abre una conversación con Claude (o Claude Code dentro del repo) y usa este prompt:

```
Genera 10 preguntas de fútbol para vídeos de TikTok de CHECK THE VAR.
Tema: [Champions / Mundial / fichajes / premios / récords…]
Dificultad: [1–3]
Reglas:
- Solo datos que puedas verificar; si dudas de alguno, no lo incluyas.
- Prioriza hechos cerrados (finales jugadas, premios entregados).
- 3 opciones plausibles y una sola correcta indiscutible.
- Enunciado de 120 caracteres como máximo y explicación de 140 como máximo.
- Devuélvelo en JSON con el formato de docs/ejemplo-lote-videos.json,
  e indica en "source" de dónde sale cada dato.
```

**Verifica tú cada dato** antes de publicar (mira la fuente que indica). Un fallo en un
vídeo de quiz se llena de comentarios corrigiéndote, y daña la credibilidad de la marca.

---

## 3. Paso 2 — Convertir las preguntas en vídeos

### Opción A · Sin programar (para empezar ya)
1. Diseña **una plantilla** en CapCut (app o escritorio) siguiendo el guion de la tabla:
   fondo oscuro, Anton para titulares, verde VAR `#39E27A`, la pantalla del VAR para la revisión.
2. Duplica la plantilla para cada pregunta y cambia solo los textos del JSON.
3. Exporta en 1080 × 1920.

Rápido para los primeros 10–20 vídeos y validar qué formato funciona.

### Opción B · Automático con Claude Code + Remotion (para escalar)
Remotion permite crear vídeos con React, y Claude Code puede programarlo por ti.
Así renderizas decenas de vídeos de una vez a partir del JSON.

1. Abre Claude Code en la raíz del repo (ya tiene `.claude/` con la skill `video-tiktok`).
2. Pídele:
   ```
   Crea apps/video con Remotion siguiendo la skill video-tiktok y la skill marca-ui.
   Composición QuizShort de 15 s que lea un lote JSON con el formato de
   docs/ejemplo-lote-videos.json y renderice un MP4 por pregunta en apps/video/out/.
   Añade un script "render" en el package.json.
   ```
3. Previsualiza con `npx remotion studio` y ajusta tiempos o animaciones pidiéndoselo a Claude.
4. Renderiza el lote: `pnpm --filter video render -- --props=./data/lote.json`.

Antes de usarlo comercialmente, revisa la licencia de Remotion: es gratuita para
particulares y equipos pequeños, pero las empresas más grandes necesitan licencia.

### Voz en off (opcional)
Puedes añadir una voz leyendo la pregunta y la respuesta. La forma más sencilla es la
voz de texto a voz de la propia TikTok o CapCut. Si generas voz con otra herramienta,
comprueba que sus condiciones permiten uso comercial.

---

## 4. Paso 3 — Publicar y medir

- **Frecuencia:** 1–2 vídeos al día, siempre con la misma estructura para que se reconozca.
- **Series fijas** alineadas con las jornadas del juego:
  - Lunes de liga · Miércoles de Champions · Viernes de fichajes · Domingo de leyendas.
- **Formatos que alternar:**
  - Clásico (el de este guion).
  - "Respuesta en comentarios": corta antes de la revisión y publica la solución como
    respuesta en vídeo al comentario más votado.
  - Fácil vs experto: dos preguntas, una sencilla y una difícil, en el mismo vídeo.
  - Reto a un creador o a la audiencia: "Si aciertas las 3, eres de Primera División".
- **Mide** en las estadísticas de TikTok la retención (¿se quedan hasta la respuesta?),
  los comentarios y los clics al perfil. Repite lo que funcione.
- Reutiliza el mismo vídeo en Instagram Reels y YouTube Shorts.

---

## 5. Lista de comprobación antes de publicar

- [ ] Dato verificado con fuente.
- [ ] Sin escudos, logos de competiciones, fotos de jugadores ni clips de partidos.
- [ ] Música de la biblioteca comercial de TikTok (si es cuenta de empresa) o propia.
- [ ] Gancho sin estadísticas inventadas ("solo el 2 % acierta").
- [ ] Texto dentro de la zona segura (no tapado por los botones de TikTok).
- [ ] Revisa si TikTok exige etiquetar el contenido como generado con IA según cómo lo
      hayas creado; sus normas sobre esto cambian, consúltalas en su centro de ayuda.
- [ ] Pie con llamada a jugar y comentario fijado.
