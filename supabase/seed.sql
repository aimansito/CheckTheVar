-- =====================================================================
--  CHECK THE VAR — Datos de prueba (solo desarrollo)
--  Se carga automáticamente con `pnpm db:reset` (Supabase local).
--  En un proyecto en la nube: pegar en el SQL Editor una sola vez.
--  Todas las preguntas están verificadas (fuente en data_sources / nota).
-- =====================================================================

-- Modos de juego ------------------------------------------------------
insert into game_modes (slug, name_es, requires_account) values
  ('daily',        'Reto diario',          false),
  ('grid',         'Grid',                 true),
  ('guess-player', 'Adivina el jugador',   true),
  ('career-path',  'Trayectoria',          true),
  ('higher-lower', 'Más o menos',          true),
  ('time-attack',  'Contrarreloj',         true),
  ('survival',     'Supervivencia',        true)
on conflict (slug) do nothing;

-- Categorías de preguntas ---------------------------------------------
insert into question_categories (slug, name_es, name_en) values
  ('liga',        'Liga',              'League'),
  ('champions',   'Champions',         'Champions League'),
  ('mundial',     'Mundial',           'World Cup'),
  ('eurocopa',    'Eurocopa',          'Euro'),
  ('premios',     'Premios',           'Awards'),
  ('fichajes',    'Fichajes',          'Transfers'),
  ('leyendas',    'Leyendas',          'Legends'),
  ('records',     'Récords',           'Records'),
  ('trayectorias','Trayectorias',      'Career paths')
on conflict (slug) do nothing;

insert into data_sources (name, license_note) values
  ('Carga manual', 'Datos verificados a mano con fuentes oficiales (FIFA, UEFA, clubes, France Football).');

-- Ayudante temporal: crea una pregunta tipo test publicada con 3 opciones.
create function pg_temp.add_question(
  p_category text, p_difficulty int, p_prompt text, p_explanation text,
  p_options text[], p_correct int, p_era_from int default null, p_era_to int default null
) returns bigint language plpgsql as $$
declare
  q_id bigint;
  o_id bigint;
  i int;
begin
  insert into questions (category_id, difficulty, status, origin, era_from, era_to, verified_at)
  values ((select id from question_categories where slug = p_category), p_difficulty,
          'published', 'manual', p_era_from, p_era_to, now())
  returning id into q_id;

  insert into question_translations (question_id, language, prompt, explanation)
  values (q_id, 'es', p_prompt, p_explanation);

  for i in 1 .. array_length(p_options, 1) loop
    insert into question_options (question_id, position, is_correct)
    values (q_id, i, i = p_correct)
    returning id into o_id;
    insert into question_option_translations (option_id, language, label)
    values (o_id, 'es', p_options[i]);
  end loop;
  return q_id;
end $$;

-- Preguntas verificadas (comprobadas el 03/11/2026) ---------------------
select pg_temp.add_question('mundial', 1,
  '¿En qué año ganó España su primer Mundial?',
  'En Sudáfrica 2010: 1-0 a Países Bajos, gol de Iniesta en la prórroga. El segundo llegó en 2026.',
  array['1982', '2010', '2026'], 2, 2010, 2010);

select pg_temp.add_question('mundial', 1,
  '¿Qué selección ganó el Mundial de 2010?',
  'España ganó la final 1-0 a Países Bajos en la prórroga.',
  array['Países Bajos', 'España', 'Alemania'], 2, 2010, 2010);

select pg_temp.add_question('champions', 1,
  '¿Quién es el máximo goleador de la historia de la Champions?',
  'Cristiano Ronaldo, con 140 goles. Messi es segundo con 129.',
  array['Lionel Messi', 'Cristiano Ronaldo', 'Robert Lewandowski'], 2);

select pg_temp.add_question('champions', 2,
  '¿Qué equipo ganó la final de Champions de 2005 en Estambul?',
  'El Liverpool remontó un 3-0 al Milan y ganó en los penaltis.',
  array['AC Milan', 'Liverpool', 'Chelsea'], 2, 2005, 2005);

select pg_temp.add_question('premios', 1,
  '¿Quién tiene más Balones de Oro?',
  'Messi tiene 8 (el último en 2023). Cristiano Ronaldo tiene 5.',
  array['Lionel Messi', 'Cristiano Ronaldo', 'Están empatados'], 1);

select pg_temp.add_question('fichajes', 1,
  '¿Cuál es el fichaje más caro de la historia?',
  '222 millones de euros: el PSG pagó la cláusula de Neymar al Barça en 2017.',
  array['Mbappé al PSG', 'Neymar al PSG', 'João Félix al Atlético'], 2, 2017, 2017);

select pg_temp.add_question('leyendas', 2,
  '¿Cuál de estos jugadores jugó en el Barça y en el Real Madrid?',
  'Figo pasó del Barça al Madrid en el año 2000. Ronaldo Nazário y Laudrup también jugaron en los dos.',
  array['Raúl González', 'Luís Figo', 'Xavi Hernández'], 2);

select pg_temp.add_question('eurocopa', 2,
  '¿Qué selección ganó la Eurocopa de 2004?',
  'Grecia ganó la final 1-0 a la anfitriona, Portugal.',
  array['Portugal', 'Francia', 'Grecia'], 3, 2004, 2004);

-- El reto diario lo crea public.ensure_daily_challenge() (al empezar la primera partida
-- del día o con el job de pg_cron), así que aquí no hace falta insertarlo.
