---
name: video-tiktok
description: Generar vídeos verticales de quiz de fútbol (pregunta, cuenta atrás, revisión CHECK THE VAR y respuesta) con Remotion en apps/video. Úsala cuando se pida crear, editar o renderizar vídeos para TikTok, Reels o Shorts.
---

# Vídeos de quiz para TikTok con Remotion

Guía completa para humanos: `docs/guion-videos-tiktok.md`.

## Especificación
- 1080 × 1920, 30 fps, 15 s (450 frames). Composición `QuizShort` en `apps/video/src/`.
- Props desde JSON (mismo formato que la skill `crear-preguntas`, más `hook` y `cta`).
- Marca: tokens y tipografías de la skill `marca-ui` (Anton + Inter, fondo oscuro, verde VAR).

## Línea de tiempo (frames a 30 fps)
| Tramo | Segundos | Contenido |
|---|---|---|
| Gancho | 0–1,5 | Texto grande: "¿Lo sabes?" / tema de la jornada |
| Pregunta | 1,5–3,5 | Enunciado aparece; opciones A/B/C entran escalonadas |
| Cuenta atrás | 3,5–8,5 | Contador 5→1 con barra que se vacía y tic por segundo |
| Revisión | 8,5–10 | Botón CHECK THE VAR pulsado → pantalla "Revisando la jugada…" |
| Respuesta | 10–13 | Opción correcta en verde + "GOL CONFIRMADO" + dato curioso |
| Cierre | 13–15 | Logo + CTA: "¿Acertaste? Juega el reto de hoy" + dominio |

## Reglas
- Zona segura: nada importante en los 250 px inferiores ni en los 150 px superiores
  (interfaz de TikTok), ni en los 120 px laterales derechos.
- Texto mínimo de 48 px; enunciado ≤ 2 líneas cuando sea posible.
- Sin escudos, logos de ligas, fotos de jugadores, clips ni música con derechos.
  Música: añadirla dentro de TikTok desde su biblioteca comercial si la cuenta es de empresa.
- Nunca afirmar estadísticas inventadas en el gancho ("solo el 3 % acierta").
- Renderizado por lotes: `pnpm --filter video render -- --props=./data/lote.json`.
- Comprobar la licencia de Remotion para el tamaño del equipo antes de usarla comercialmente.
