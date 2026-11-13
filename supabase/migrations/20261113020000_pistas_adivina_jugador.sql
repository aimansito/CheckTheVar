-- =====================================================================
--  Adivina el jugador / Trayectoria
--  - Un fallo con pistas pendientes no cierra la pregunta: destapa la siguiente pista.
--  - Las pistas de "Adivina el jugador" se barajan: la de nacimiento y posición (antes la
--    primera) ya no abre nunca, y las iniciales siguen siendo la última.
-- =====================================================================

create or replace function public.game_submit(
  p_session uuid, p_user uuid, p_guest uuid, p_position int, p_choice text, p_text text, p_lang text default 'es')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s game_sessions;
  v_a session_answers;
  v_q questions;
  v_option bigint;
  v_correct_letter text;
  v_correct_label text;
  v_raw_correct boolean;
  v_last_miss int;
  v_explanation text;
  v_total int;
begin
  v_s := _game_owned_session(p_session, p_user, p_guest);
  v_total := _game_session_total(v_s);

  select * into v_a from session_answers
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  for update;
  if v_a.session_id is null then
    raise exception 'question_not_shown';
  end if;
  select * into v_q from questions where id = v_a.question_id;

  select o.letter, o.label into v_correct_letter, v_correct_label
  from _game_options(v_s.id, v_a.question_id, p_lang) o where o.is_correct limit 1;

  select coalesce(t.explanation, t_es.explanation) into v_explanation
  from questions q
  left join question_translations t    on t.question_id = q.id and t.language = p_lang
  left join question_translations t_es on t_es.question_id = q.id and t_es.language = 'es'
  where q.id = v_a.question_id;

  -- Racha antes de esta respuesta: aciertos seguidos desde el último fallo.
  select max(position) into v_last_miss from session_answers
  where session_id = v_s.id and session_started = v_s.started_at
    and position < p_position and coalesce(is_correct, false) = false;

  if v_a.answered_at is not null then
    return jsonb_build_object(
      'alreadyAnswered', true, 'scored', v_a.scored_at is not null,
      'mode', (select slug from game_modes where id = v_s.game_mode_id), 'difficulty', v_s.difficulty,
      'position', p_position, 'total', v_total,
      'format', v_q.format, 'choice', v_a.choice, 'answerText', v_a.answer_text,
      'rawCorrect', case when v_q.format = 'free_text'
                         then v_a.answer_text is not null and _game_text_matches(v_q.id, v_a.answer_text)
                         else coalesce(v_a.choice = v_correct_letter, false) end,
      'isCorrect', v_a.is_correct, 'points', v_a.points,
      'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
      'cluesUsed', v_a.clues_used, 'cluesTotal', _game_clue_total(v_q.id),
      'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
      'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
      'explanation', v_explanation, 'sessionScore', v_s.score, 'status', v_s.status);
  end if;

  if v_s.status <> 'started' then
    raise exception 'session_closed';
  end if;

  if v_q.format = 'free_text' then
    if p_choice is not null then
      raise exception 'invalid_choice';
    end if;
    v_raw_correct := p_text is not null and _game_text_matches(v_q.id, p_text);
    -- Fallo con pistas pendientes: la pregunta sigue abierta y se destapa la siguiente pista.
    -- Solo se pierde al fallar con todas las pistas a la vista (o si se acaba el tiempo).
    if not v_raw_correct and p_text is not null and v_a.clues_used < _game_clue_total(v_q.id) then
      update session_answers set clues_used = clues_used + 1
      where session_id = v_s.id and session_started = v_s.started_at and position = p_position
      returning * into v_a;
      return jsonb_build_object(
        'retry', true, 'position', p_position, 'answerText', left(p_text, 80),
        'clues', _game_clues(v_q.id, v_a.clues_used, p_lang),
        'cluesUsed', v_a.clues_used, 'cluesTotal', _game_clue_total(v_q.id));
    end if;
  else
    if p_text is not null then
      raise exception 'invalid_choice';
    end if;
    if p_choice is not null then
      select o.option_id into v_option
      from _game_options(v_s.id, v_a.question_id, p_lang) o where o.letter = upper(p_choice);
      if v_option is null then
        raise exception 'invalid_choice';
      end if;
    end if;
    v_raw_correct := p_choice is not null and upper(p_choice) = v_correct_letter;
  end if;

  update session_answers
  set answered_at = now(), option_id = v_option, choice = upper(p_choice), answer_text = left(p_text, 80)
  where session_id = v_s.id and session_started = v_s.started_at and position = p_position
  returning * into v_a;

  return jsonb_build_object(
    'alreadyAnswered', false, 'scored', false,
    'mode', (select slug from game_modes where id = v_s.game_mode_id), 'difficulty', v_s.difficulty,
    'position', p_position, 'total', v_total,
    'format', v_q.format, 'choice', v_a.choice, 'answerText', v_a.answer_text,
    'rawCorrect', v_raw_correct,
    'elapsedMs', floor(extract(epoch from (v_a.answered_at - v_a.shown_at)) * 1000)::int,
    'cluesUsed', v_a.clues_used, 'cluesTotal', _game_clue_total(v_q.id),
    'streakBefore', p_position - 1 - coalesce(v_last_miss, 0),
    'correctOptionId', v_correct_letter, 'correctLabel', v_correct_label,
    'explanation', v_explanation, 'sessionScore', v_s.score, 'status', v_s.status);
end $$;

-- Baraja las pistas ya generadas (menos la última, las iniciales).
create temp table _clue_order on commit drop as
select c.question_id, c.position as old_pos,
       row_number() over (partition by c.question_id order by (c.position = 1), random())::smallint as new_pos
from question_clues c
join questions q on q.id = c.question_id and q.kind = 'guess_player'
where c.language = 'es'
  and c.position < (select max(c2.position) from question_clues c2
                    where c2.question_id = c.question_id and c2.language = 'es');

create temp table _clues_moved on commit drop as
select c.question_id, o.new_pos as position, c.language, c.clue
from question_clues c
join _clue_order o on o.question_id = c.question_id and o.old_pos = c.position;

delete from question_clues c using _clue_order o
where c.question_id = o.question_id and c.position = o.old_pos;

insert into question_clues (question_id, position, language, clue)
select question_id, position, language, clue from _clues_moved;
