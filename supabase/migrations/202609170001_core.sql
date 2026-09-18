create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.room_kind as enum ('personal', 'official');
create type public.material_status as enum ('uploaded', 'processing', 'ready', 'failed');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  public_alias text not null unique check (char_length(public_alias) between 6 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  kind public.room_kind not null,
  title text not null check (char_length(title) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint room_owner_shape check (
    (kind = 'personal' and owner_id is not null) or
    (kind = 'official' and owner_id is null)
  )
);

create index rooms_owner_updated_idx on public.rooms(owner_id, updated_at desc) where deleted_at is null;

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 160),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  status public.material_status not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index materials_room_created_idx on public.materials(room_id, created_at desc);

create table private.official_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (char_length(prompt) between 1 and 500),
  choices text[] not null check (cardinality(choices) between 2 and 6),
  correct_choice smallint not null check (correct_choice >= 0),
  points integer not null default 100 check (points between 1 and 1000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint correct_choice_in_range check (correct_choice < cardinality(choices))
);

create table private.official_member_attempts (
  id bigint generated always as identity primary key,
  member_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references private.official_questions(id) on delete cascade,
  selected_choice smallint not null,
  is_correct boolean not null,
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique(member_id, question_id)
);

create table private.official_guest_scores (
  guest_id uuid primary key,
  public_label text not null unique,
  score integer not null default 0 check (score >= 0),
  updated_at timestamptz not null default now()
);

create table private.official_guest_attempts (
  id bigint generated always as identity primary key,
  guest_id uuid not null references private.official_guest_scores(guest_id) on delete cascade,
  question_id uuid not null references private.official_questions(id) on delete cascade,
  selected_choice smallint not null,
  is_correct boolean not null,
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique(guest_id, question_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger rooms_updated_at before update on public.rooms for each row execute function public.set_updated_at();
create trigger materials_updated_at before update on public.materials for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  candidate text;
begin
  candidate := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'user_name', 'STUDYER');
  insert into public.profiles(user_id, display_name, public_alias)
  values (
    new.id,
    left(coalesce(nullif(trim(candidate), ''), 'STUDYER'), 40),
    'STUDY-' || upper(substr(md5(new.id::text), 1, 8))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.materials enable row level security;

revoke all on public.profiles, public.rooms, public.materials from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.materials to authenticated;

create policy profiles_select_self on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy rooms_select on public.rooms for select to authenticated
using (deleted_at is null and ((kind = 'personal' and owner_id = auth.uid()) or kind = 'official'));
create policy rooms_insert_personal on public.rooms for insert to authenticated
with check (kind = 'personal' and owner_id = auth.uid() and deleted_at is null);
create policy rooms_update_personal on public.rooms for update to authenticated
using (kind = 'personal' and owner_id = auth.uid() and deleted_at is null)
with check (kind = 'personal' and owner_id = auth.uid());
create policy rooms_delete_personal on public.rooms for delete to authenticated
using (kind = 'personal' and owner_id = auth.uid());

create policy materials_select_owner on public.materials for select to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = auth.uid() and r.kind = 'personal' and r.deleted_at is null));
create policy materials_insert_owner on public.materials for insert to authenticated
with check (owner_id = auth.uid() and exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = auth.uid() and r.kind = 'personal' and r.deleted_at is null));
create policy materials_update_owner on public.materials for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy materials_delete_owner on public.materials for delete to authenticated using (owner_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('study-materials', 'study-materials', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy storage_insert_own_materials on storage.objects for insert to authenticated
with check (bucket_id = 'study-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_select_own_materials on storage.objects for select to authenticated
using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_delete_own_materials on storage.objects for delete to authenticated
using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.get_official_questions()
returns table(id uuid, prompt text, choices text[], points integer)
language sql stable security definer
set search_path = public, private
as $$
  select q.id, q.prompt, q.choices, q.points
  from private.official_questions q
  where q.active
  order by q.sort_order, q.created_at;
$$;

create or replace function public.get_official_leaderboard(p_limit integer default 30)
returns table(rank bigint, display_name text, score bigint, actor_type text)
language sql stable security definer
set search_path = public, private
as $$
  with member_scores as (
    select coalesce(p.public_alias, 'STUDY-UNKNOWN') as display_name,
           sum(a.points_awarded)::bigint as score,
           'member'::text as actor_type
    from private.official_member_attempts a
    left join public.profiles p on p.user_id = a.member_id
    group by a.member_id, p.public_alias
  ), all_scores as (
    select display_name, score, actor_type from member_scores
    union all
    select g.public_label, g.score::bigint, 'guest'::text
    from private.official_guest_scores g
    where g.updated_at >= now() - interval '3 days'
  )
  select row_number() over (order by s.score desc, s.display_name asc), s.display_name, s.score, s.actor_type
  from all_scores s
  where s.score > 0
  order by s.score desc, s.display_name asc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.submit_official_answer(
  p_actor_type text,
  p_actor_id text,
  p_question_id uuid,
  p_choice smallint
)
returns table(correct boolean, awarded_points integer, total_score bigint)
language plpgsql security definer
set search_path = public, private, auth
as $$
declare
  v_correct_choice smallint;
  v_points integer;
  v_is_correct boolean;
  v_inserted integer := 0;
  v_awarded integer := 0;
  v_total bigint := 0;
  v_member uuid;
  v_guest uuid;
begin
  select q.correct_choice, q.points into v_correct_choice, v_points
  from private.official_questions q where q.id = p_question_id and q.active;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  if p_choice < 0 or p_choice >= (select cardinality(choices) from private.official_questions where id = p_question_id) then
    raise exception 'INVALID_CHOICE';
  end if;
  v_is_correct := p_choice = v_correct_choice;

  if p_actor_type = 'member' then
    v_member := p_actor_id::uuid;
    if not exists (select 1 from auth.users where id = v_member) then raise exception 'MEMBER_NOT_FOUND'; end if;
    insert into private.official_member_attempts(member_id, question_id, selected_choice, is_correct, points_awarded)
    values (v_member, p_question_id, p_choice, v_is_correct, case when v_is_correct then v_points else 0 end)
    on conflict (member_id, question_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 and v_is_correct then v_awarded := v_points; end if;
    select coalesce(sum(a.points_awarded), 0)::bigint into v_total from private.official_member_attempts a where a.member_id = v_member;
  elsif p_actor_type = 'guest' then
    v_guest := p_actor_id::uuid;
    insert into private.official_guest_scores(guest_id, public_label, score, updated_at)
    values (v_guest, 'GUEST-' || upper(substr(md5(v_guest::text), 1, 4)), 0, now())
    on conflict (guest_id) do update set updated_at = now();
    insert into private.official_guest_attempts(guest_id, question_id, selected_choice, is_correct, points_awarded)
    values (v_guest, p_question_id, p_choice, v_is_correct, case when v_is_correct then v_points else 0 end)
    on conflict (guest_id, question_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 and v_is_correct then
      v_awarded := v_points;
      update private.official_guest_scores set score = score + v_points, updated_at = now() where guest_id = v_guest;
    else
      update private.official_guest_scores set updated_at = now() where guest_id = v_guest;
    end if;
    select g.score::bigint into v_total from private.official_guest_scores g where g.guest_id = v_guest;
  else
    raise exception 'INVALID_ACTOR';
  end if;
  return query select v_is_correct, v_awarded, v_total;
end;
$$;

create or replace function private.cleanup_guest_scores()
returns void language sql security definer set search_path = private as $$
  delete from private.official_guest_scores where updated_at < now() - interval '3 days';
$$;

revoke all on function public.get_official_questions() from public;
revoke all on function public.get_official_leaderboard(integer) from public;
revoke all on function public.submit_official_answer(text, text, uuid, smallint) from public;
grant execute on function public.get_official_questions() to anon, authenticated;
grant execute on function public.get_official_leaderboard(integer) to anon, authenticated;
grant execute on function public.submit_official_answer(text, text, uuid, smallint) to service_role;
