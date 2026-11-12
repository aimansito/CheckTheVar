-- =====================================================================
-- Datos de fútbol importables desde los lotes JSON (docs/datos/).
--  1) Códigos de país de hasta 6 caracteres: ISO 3166-1 (ES) y subdivisiones
--     con selección propia (GB-ENG, GB-SCT, GB-WLS, GB-NIR).
--  2) `slug`: identificador estable de cada entidad en los lotes, para que
--     reimportar actualice en vez de duplicar.
--  3) `source_url` en cada fila: de dónde sale el dato (CLAUDE.md: nunca
--     inventar datos; sin fuente no se generan preguntas).
--  4) Fechas parciales: muchas fuentes solo dan el año (trayectorias, fichajes
--     históricos). Se guarda el año aparte y la fecha exacta solo si se conoce.
--  5) Claves naturales únicas para que la importación sea idempotente.
-- =====================================================================

-- 1) Códigos de país -----------------------------------------------------
alter table teams        drop constraint teams_country_code_fkey;
alter table competitions drop constraint competitions_country_code_fkey;
alter table seasons      drop constraint seasons_host_country_fkey;
alter table players      drop constraint players_nationality_fkey;
alter table players      drop constraint players_second_nationality_fkey;

alter table countries    alter column code               type varchar(6);
alter table teams        alter column country_code       type varchar(6);
alter table competitions alter column country_code       type varchar(6);
alter table seasons      alter column host_country       type varchar(6);
alter table players      alter column nationality        type varchar(6);
alter table players      alter column second_nationality type varchar(6);
alter table users        alter column country_code       type varchar(6);

alter table countries add constraint countries_code_format check (code ~ '^[A-Z]{2}(-[A-Z]{3})?$');

alter table teams        add constraint teams_country_code_fkey        foreign key (country_code)       references countries(code);
alter table competitions add constraint competitions_country_code_fkey foreign key (country_code)       references countries(code);
alter table seasons      add constraint seasons_host_country_fkey      foreign key (host_country)       references countries(code);
alter table players      add constraint players_nationality_fkey       foreign key (nationality)        references countries(code);
alter table players      add constraint players_second_nationality_fkey foreign key (second_nationality) references countries(code);

-- 2) y 3) slug + source_url ------------------------------------------------
alter table teams        add column slug text unique, add column source_url text;
alter table competitions add column slug text unique, add column source_url text;
alter table seasons      add column slug text unique, add column source_url text;
alter table players      add column slug text unique, add column source_url text;
alter table awards       add column slug text unique, add column source_url text;
alter table matches      add column slug text unique, add column source_url text;
alter table player_spells       add column source_url text;
alter table transfers           add column source_url text;
alter table award_winners       add column source_url text;
alter table competition_winners add column source_url text;

-- Jugadores: "retirado" puede ser desconocido (null) si la fuente no lo deja claro.
alter table players alter column retired drop not null;
alter table players add constraint players_foot_check check (foot in ('left', 'right', 'both'));

-- 4) Fechas parciales ---------------------------------------------------
alter table player_spells add column start_year int, add column end_year int;
alter table player_spells add constraint player_spells_years_check
  check (start_year is null or end_year is null or end_year >= start_year);

alter table transfers alter column transfer_date drop not null;
alter table transfers add column transfer_year int;
alter table transfers add constraint transfers_when_check check (transfer_date is not null or transfer_year is not null);
create index transfers_year on transfers(transfer_year);

-- Partidos antiguos sin fecha exacta en la fuente (p. ej. finales de la Eurocopa 1960 y 1964).
alter table matches alter column match_date drop not null;

-- 5) Claves naturales -----------------------------------------------------
alter table player_spells add constraint player_spells_natural_key
  unique nulls not distinct (player_id, team_id, start_year, is_loan);
alter table transfers add constraint transfers_natural_key
  unique nulls not distinct (player_id, to_team_id, transfer_year);
alter table award_winners add constraint award_winners_natural_key
  unique nulls not distinct (award_id, year_label, player_id, team_id);
alter table records add constraint records_title_key unique (title);

create index award_winners_player on award_winners(player_id);
create index competition_winners_team on competition_winners(team_id);

-- Fuente de los lotes.
insert into data_sources (name, license_note)
select 'Lotes JSON (Wikipedia y webs oficiales)',
       'Hechos verificados por fila en source_url. Los hechos no tienen copyright; '
       'no se copian textos ni imágenes de Wikipedia (CC BY-SA).'
where not exists (select 1 from data_sources where name = 'Lotes JSON (Wikipedia y webs oficiales)');
