---
name: flujo-juego-antitrampas
description: Ciclo de vida de una partida (empezar, servir preguntas, Check the VAR, puntuar, cerrar) con validación en servidor. Úsala al implementar cualquier modo de juego, endpoint de partida o lógica de puntuación.
---

# Flujo de partida y antitrampas

El cliente **nunca** decide si una respuesta es correcta ni conoce la respuesta antes de tiempo.

## Ciclo
1. `POST /game/start` { mode, challengeId? }
   - Comprueba acceso: invitado → solo `daily` y una vez al día (Redis + `guest_sessions`);
     registrado → según `game_modes.requires_*`.
   - Si ya existe una sesión para ese reto, devuelve la existente (no se puede reiniciar).
   - Crea `game_sessions` con `status = 'started'` y `started_at = now()` del servidor.
2. `GET /game/:id/next`
   - Devuelve UNA pregunta: enunciado + opciones **sin** `is_correct`.
   - Inserta `session_answers` con `shown_at = now()`.
3. `POST /game/:id/answer` { position, optionId | text } ← al pulsar **CHECK THE VAR**
   - `answered_at = now()`. Si `answered_at - shown_at` supera el límite (+ 1 s de margen
     de red), cuenta como fallo.
   - Corrige en servidor y calcula puntos con `packages/shared/src/scoring.ts`.
   - Solo ahora devuelve: `isCorrect`, opción correcta, explicación y puntos.
4. Tras la última pregunta → `status = 'finished'`; actualiza `user_stats`,
   `user_category_stats`, `question_stats`, rachas y ranking en Redis.
5. Sesiones `started` sin actividad durante más de 30 min → un job las marca `abandoned`
   y puntúa lo respondido.

## Reglas
- Respuestas idempotentes: responder dos veces la misma posición devuelve el primer resultado.
- Rate limit por usuario/IP en `start` y `answer`.
- Texto libre: normalizar (minúsculas, sin tildes, trim) y comparar con
  `question_accepted_answers`; para nombres de jugador, aceptar también alias.
- El orden de las opciones se baraja en servidor por sesión; ningún ID ni orden revela la respuesta.
- Respuestas en menos de 400 ms de forma repetida → marcar la cuenta para revisión.

## Tests mínimos
Respuesta tardía, doble respuesta, reinicio de reto diario, invitado jugando dos veces,
bonus por rapidez y hat-trick.
