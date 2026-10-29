-- ============================================================
-- Datos de ejemplo (opcional)
-- ============================================================
-- Corre esto DESPUES de aplicar la migracion inicial. Es seguro correrlo mas
-- de una vez. El curso y el evento de demo se crean solo si ya existe al menos
-- un perfil (registrate primero en la app y vuelve a correrlo).

-- Ficha de la comunidad (barra lateral del feed)
insert into public.community_settings (name, description)
select 'Mi Comunidad', 'Aprende, comparte y crece con tu comunidad'
where not exists (select 1 from public.community_settings);

-- Categorias del feed
insert into public.categories (name, slug, color, description, order_position, emoji, permissions)
values
  ('General', 'general', '#6366f1', 'Conversacion abierta de la comunidad', 1, '💬', 'members'),
  ('Presentaciones', 'presentaciones', '#22c55e', 'Cuentanos quien eres y que construyes', 2, '👋', 'members'),
  ('Preguntas', 'preguntas', '#f59e0b', 'Dudas y ayuda entre miembros', 3, '❓', 'members'),
  ('Anuncios', 'anuncios', '#ef4444', 'Avisos del equipo', 4, '📣', 'admins')
on conflict (slug) do nothing;

-- Premios por nivel (se editan desde /admin > Leaderboard)
insert into public.level_rewards (level, title, description, icon)
select n, 'Nivel ' || n, 'Desbloquea los cursos de nivel ' || n || ' y lo que definas aqui.', '🎁'
from generate_series(1, 9) as n
where not exists (select 1 from public.level_rewards lr where lr.level = n);

-- Curso y evento de demo
do $$
declare
  v_owner uuid;
  v_course uuid;
  v_folder uuid;
begin
  select id into v_owner from public.profiles
  order by (role = 'owner') desc, created_at asc
  limit 1;

  if v_owner is null then
    raise notice 'Sin perfiles todavia: registrate en la app y vuelve a correr este archivo para crear el curso y el evento de demo.';
    return;
  end if;

  if not exists (select 1 from public.courses where title = 'Bienvenida') then
    insert into public.courses (title, description, created_by, published, order_position, access_type)
    values ('Bienvenida', 'Todo lo que necesitas para arrancar en la comunidad.', v_owner, true, 1, 'open')
    returning id into v_course;

    insert into public.folders (course_id, title, order_position, published)
    values (v_course, 'Primeros pasos', 1, true)
    returning id into v_folder;

    insert into public.lessons (course_id, folder_id, title, content, order_position, published)
    values
      (v_course, v_folder, 'Como funciona la comunidad',
       '<p>Presentate en el feed, completa tus lecciones y suma puntos para subir de nivel.</p>',
       1, true),
      (v_course, v_folder, 'Tu primera llamada en vivo',
       '<p>Revisa el calendario y entra a la sala desde el evento cuando empiece.</p>',
       2, true);
  end if;

  if not exists (select 1 from public.events where title = 'Llamada de bienvenida') then
    insert into public.events (title, description, start_time, end_time, duration_minutes, created_by, host_id)
    values (
      'Llamada de bienvenida',
      'Conoce a la comunidad en vivo.',
      date_trunc('hour', now()) + interval '7 days',
      date_trunc('hour', now()) + interval '7 days 1 hour',
      60,
      v_owner,
      v_owner
    );
  end if;
end $$;
