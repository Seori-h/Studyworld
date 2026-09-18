-- RC1 follow-up: product terminology, Basic Test runs, personal-room rules, and support tickets.

alter type public.room_kind rename value 'official' to 'commons';

alter table private.official_questions rename to basic_questions;
alter table private.official_member_attempts rename to basic_member_attempts;
alter table private.official_guest_scores rename to basic_guest_scores;
alter table private.official_guest_attempts rename to basic_guest_attempts;

alter table private.basic_questions
  add column if not exists category text not null default '상식',
  add column if not exists explanation text not null default '정답을 확인하고 핵심 개념을 함께 기억해보세요.';

alter table private.basic_guest_scores rename column public_label to display_name;

alter table private.basic_member_attempts add column if not exists run_id uuid;
alter table private.basic_guest_attempts add column if not exists run_id uuid;

alter table private.basic_member_attempts drop constraint if exists official_member_attempts_member_id_question_id_key;
alter table private.basic_guest_attempts drop constraint if exists official_guest_attempts_guest_id_question_id_key;
alter table private.basic_member_attempts drop constraint if exists basic_member_attempts_member_id_question_id_key;
alter table private.basic_guest_attempts drop constraint if exists basic_guest_attempts_guest_id_question_id_key;

create table private.basic_test_runs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('member', 'guest')),
  member_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references private.basic_guest_scores(guest_id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint basic_test_run_actor_shape check (
    (actor_type = 'member' and member_id is not null and guest_id is null) or
    (actor_type = 'guest' and guest_id is not null and member_id is null)
  )
);

create table private.basic_test_run_questions (
  run_id uuid not null references private.basic_test_runs(id) on delete cascade,
  question_id uuid not null references private.basic_questions(id) on delete restrict,
  position smallint not null check (position between 1 and 10),
  primary key (run_id, question_id),
  unique (run_id, position)
);

alter table private.basic_member_attempts
  add constraint basic_member_attempts_run_fk foreign key (run_id) references private.basic_test_runs(id) on delete cascade;
alter table private.basic_guest_attempts
  add constraint basic_guest_attempts_run_fk foreign key (run_id) references private.basic_test_runs(id) on delete cascade;
create unique index basic_member_attempts_run_question_uq on private.basic_member_attempts(run_id, question_id) where run_id is not null;
create unique index basic_guest_attempts_run_question_uq on private.basic_guest_attempts(run_id, question_id) where run_id is not null;

alter table public.rooms drop constraint if exists room_owner_shape;
alter table public.rooms add constraint room_owner_shape check ((kind='personal' and owner_id is not null) or kind='commons');

update public.rooms set title = '광장 Basic Test' where kind = 'commons' and id = '00000000-0000-4000-8000-000000000001';

insert into private.basic_questions(id, category, prompt, choices, correct_choice, points, sort_order, explanation)
values
  ('10000000-0000-4000-8000-000000000004','과학','식물이 빛을 이용해 양분을 만드는 과정은?',array['증산','광합성','호흡','발효'],1,10,40,'광합성은 빛 에너지를 이용해 이산화탄소와 물로 유기물을 만드는 과정입니다.'),
  ('10000000-0000-4000-8000-000000000005','역사','조선의 훈민정음이 반포된 왕의 재위기는?',array['태조','세종','성종','정조'],1,10,50,'훈민정음은 세종 재위기에 창제되고 1446년에 반포되었습니다.'),
  ('10000000-0000-4000-8000-000000000006','지리','세계에서 면적이 가장 큰 대양은?',array['대서양','인도양','태평양','북극해'],2,10,60,'태평양은 지구에서 가장 넓고 깊은 대양입니다.'),
  ('10000000-0000-4000-8000-000000000007','문화','오선지에서 기본적으로 사용하는 선의 개수는?',array['4개','5개','6개','7개'],1,10,70,'현대 서양 음악의 오선지는 다섯 개의 평행한 선을 기본으로 사용합니다.'),
  ('10000000-0000-4000-8000-000000000008','과학','사람이 호흡할 때 주로 들이마시는 기체 중 가장 비율이 높은 것은?',array['산소','질소','이산화탄소','수소'],1,10,80,'대기의 약 78%는 질소이며 산소는 약 21%입니다.'),
  ('10000000-0000-4000-8000-000000000009','지리','대한민국에서 가장 큰 섬은?',array['거제도','진도','제주도','강화도'],2,10,90,'제주도는 대한민국에서 면적이 가장 큰 섬입니다.'),
  ('10000000-0000-4000-8000-000000000010','역사','고려를 건국한 인물은?',array['왕건','궁예','견훤','이성계'],0,10,100,'왕건은 918년에 고려를 건국했습니다.'),
  ('10000000-0000-4000-8000-000000000011','과학','지구의 유일한 자연위성은?',array['화성','금성','달','태양'],2,10,110,'달은 지구 주위를 공전하는 지구의 유일한 자연위성입니다.'),
  ('10000000-0000-4000-8000-000000000012','문화','한글 자음 기본자 중 발음기관 모양을 본뜬 원리에 해당하는 것은?',array['상형','가획','합성','연서'],0,10,120,'훈민정음의 기본 자음은 발음기관의 모양을 본뜨는 상형 원리를 사용했습니다.'),
  ('10000000-0000-4000-8000-000000000013','지리','적도가 지나는 대륙이 아닌 것은?',array['아프리카','남아메리카','아시아','유럽'],3,10,130,'적도는 아프리카·남아메리카·아시아의 섬 지역 등을 지나지만 유럽은 지나지 않습니다.'),
  ('10000000-0000-4000-8000-000000000014','과학','물의 어는점은 표준기압에서 섭씨 몇 도인가?',array['0도','10도','32도','100도'],0,10,140,'표준기압에서 순수한 물의 어는점은 0℃입니다.'),
  ('10000000-0000-4000-8000-000000000015','역사','대한민국 임시정부가 수립된 해는?',array['1910년','1919년','1945년','1948년'],1,10,150,'대한민국 임시정부는 3·1 운동 이후인 1919년에 수립되었습니다.'),
  ('10000000-0000-4000-8000-000000000016','문화','소설·시·희곡 가운데 무대 공연을 전제로 대사와 행동으로 구성되는 장르는?',array['시','수필','희곡','평론'],2,10,160,'희곡은 무대 공연을 전제로 인물의 대사와 행동을 중심으로 구성됩니다.'),
  ('10000000-0000-4000-8000-000000000017','지리','한반도 동쪽에 있는 바다는?',array['황해','동해','남중국해','지중해'],1,10,170,'한반도의 동쪽에는 동해가 있습니다.'),
  ('10000000-0000-4000-8000-000000000018','과학','태양계에서 태양과 가장 가까운 행성은?',array['수성','금성','지구','화성'],0,10,180,'수성은 태양에서 가장 가까운 행성입니다.'),
  ('10000000-0000-4000-8000-000000000019','역사','조선을 건국한 인물은?',array['왕건','이성계','이방원','정도전'],1,10,190,'이성계는 1392년에 조선을 건국하고 태조가 되었습니다.'),
  ('10000000-0000-4000-8000-000000000020','문화','도서관에서 책을 분류하고 찾기 쉽게 붙이는 식별 정보와 가장 가까운 것은?',array['청구기호','ISBN만','페이지 번호','발행가'],0,10,200,'청구기호는 도서의 분류와 서가 위치를 식별하는 데 사용됩니다.')
on conflict (id) do nothing;

update private.basic_questions set points = 10 where points <> 10;
update private.basic_questions set category = case id
  when '10000000-0000-4000-8000-000000000001'::uuid then '지리'
  when '10000000-0000-4000-8000-000000000002'::uuid then '과학'
  when '10000000-0000-4000-8000-000000000003'::uuid then '과학'
  else category end;

create or replace function public.set_basic_guest_nickname(p_guest_id uuid, p_nickname text)
returns text language plpgsql security definer set search_path = public, private as $$
declare v_name text := regexp_replace(trim(p_nickname), '\s+', ' ', 'g');
begin
  if char_length(v_name) < 2 or char_length(v_name) > 12 or v_name !~ '^[가-힣A-Za-z0-9 ]+$' then
    raise exception 'INVALID_NICKNAME';
  end if;
  insert into private.basic_guest_scores(guest_id, display_name, score, updated_at)
  values (p_guest_id, v_name, 0, now())
  on conflict (guest_id) do update set display_name = excluded.display_name, updated_at = now();
  return v_name;
exception when unique_violation then
  raise exception 'NICKNAME_TAKEN';
end;
$$;

create or replace function public.start_basic_test(p_actor_type text, p_actor_id text)
returns jsonb language plpgsql security definer set search_path = public, private, auth as $$
declare v_run uuid; v_actor uuid := p_actor_id::uuid; v_previous uuid; v_count integer;
begin
  if (select count(*) from private.basic_test_runs where started_at > now()-interval '1 hour' and ((p_actor_type='member' and member_id=v_actor) or (p_actor_type='guest' and guest_id=v_actor))) >= 30 then raise exception 'RATE_LIMITED'; end if;
  if p_actor_type = 'member' then
    if not exists (select 1 from auth.users where id = v_actor) then raise exception 'MEMBER_NOT_FOUND'; end if;
    select id into v_previous from private.basic_test_runs where member_id = v_actor order by started_at desc limit 1;
    insert into private.basic_test_runs(actor_type, member_id) values ('member', v_actor) returning id into v_run;
  elsif p_actor_type = 'guest' then
    if not exists (select 1 from private.basic_guest_scores where guest_id = v_actor) then raise exception 'GUEST_NICKNAME_REQUIRED'; end if;
    update private.basic_guest_scores set updated_at = now() where guest_id = v_actor;
    select id into v_previous from private.basic_test_runs where guest_id = v_actor order by started_at desc limit 1;
    insert into private.basic_test_runs(actor_type, guest_id) values ('guest', v_actor) returning id into v_run;
  else raise exception 'INVALID_ACTOR'; end if;

  insert into private.basic_test_run_questions(run_id, question_id, position)
  select v_run, picked.id, row_number() over ()::smallint
  from (
    select q.id
    from private.basic_questions q
    where q.active
    order by case when v_previous is not null and exists (
      select 1 from private.basic_test_run_questions lastq where lastq.run_id = v_previous and lastq.question_id = q.id
    ) then 1 else 0 end, random()
    limit 10
  ) picked;

  select count(*) into v_count from private.basic_test_run_questions where run_id = v_run;
  if v_count < 10 then raise exception 'QUESTION_BANK_TOO_SMALL'; end if;

  return jsonb_build_object(
    'run_id', v_run,
    'questions', (
      select jsonb_agg(jsonb_build_object('id', q.id, 'category', q.category, 'prompt', q.prompt, 'choices', q.choices, 'points', q.points) order by rq.position)
      from private.basic_test_run_questions rq join private.basic_questions q on q.id = rq.question_id where rq.run_id = v_run
    )
  );
end;
$$;

create or replace function public.submit_basic_answer(
  p_actor_type text, p_actor_id text, p_run_id uuid, p_question_id uuid, p_choice smallint
)
returns table(correct boolean, awarded_points integer, total_score bigint, explanation text, correct_choice smallint, completed boolean)
language plpgsql security definer set search_path = public, private, auth as $$
declare v_actor uuid := p_actor_id::uuid; v_correct smallint; v_points integer; v_is_correct boolean; v_inserted integer := 0; v_awarded integer := 0; v_total bigint := 0; v_explanation text; v_answered integer;
begin
  if p_actor_type = 'member' then
    if not exists (select 1 from private.basic_test_runs where id=p_run_id and member_id=v_actor and completed_at is null) then raise exception 'RUN_NOT_FOUND'; end if;
  elsif p_actor_type = 'guest' then
    if not exists (select 1 from private.basic_test_runs where id=p_run_id and guest_id=v_actor and completed_at is null) then raise exception 'RUN_NOT_FOUND'; end if;
  else raise exception 'INVALID_ACTOR'; end if;

  select q.correct_choice, q.points, q.explanation into v_correct, v_points, v_explanation
  from private.basic_test_run_questions rq join private.basic_questions q on q.id=rq.question_id
  where rq.run_id=p_run_id and rq.question_id=p_question_id;
  if not found or p_choice < 0 or p_choice >= (select cardinality(choices) from private.basic_questions where id=p_question_id) then raise exception 'INVALID_ANSWER'; end if;
  v_is_correct := p_choice = v_correct;

  if p_actor_type = 'member' then
    insert into private.basic_member_attempts(member_id, question_id, selected_choice, is_correct, points_awarded, run_id)
    values (v_actor,p_question_id,p_choice,v_is_correct,case when v_is_correct then v_points else 0 end,p_run_id)
    on conflict (run_id, question_id) where run_id is not null do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted=1 and v_is_correct then v_awarded:=v_points; end if;
    select coalesce(sum(points_awarded),0)::bigint into v_total from private.basic_member_attempts where member_id=v_actor;
    select count(*) into v_answered from private.basic_member_attempts where member_id=v_actor and run_id=p_run_id;
  else
    insert into private.basic_guest_attempts(guest_id, question_id, selected_choice, is_correct, points_awarded, run_id)
    values (v_actor,p_question_id,p_choice,v_is_correct,case when v_is_correct then v_points else 0 end,p_run_id)
    on conflict (run_id, question_id) where run_id is not null do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted=1 and v_is_correct then
      v_awarded:=v_points;
      update private.basic_guest_scores set score=score+v_points,updated_at=now() where guest_id=v_actor;
    else update private.basic_guest_scores set updated_at=now() where guest_id=v_actor; end if;
    select score::bigint into v_total from private.basic_guest_scores where guest_id=v_actor;
    select count(*) into v_answered from private.basic_guest_attempts where guest_id=v_actor and run_id=p_run_id;
  end if;

  if v_answered >= 10 then update private.basic_test_runs set completed_at=coalesce(completed_at,now()) where id=p_run_id; end if;
  return query select v_is_correct,v_awarded,v_total,v_explanation,v_correct,(v_answered>=10);
end;
$$;

create or replace function public.get_basic_leaderboard(p_limit integer default 30)
returns table(rank bigint, display_name text, score bigint, actor_type text)
language sql stable security definer set search_path = public, private as $$
  with member_scores as (
    select coalesce(p.public_alias,'STUDY-UNKNOWN') display_name,sum(a.points_awarded)::bigint score,'member'::text actor_type
    from private.basic_member_attempts a left join public.profiles p on p.user_id=a.member_id group by a.member_id,p.public_alias
  ), all_scores as (
    select * from member_scores union all
    select g.display_name,g.score::bigint,'guest'::text from private.basic_guest_scores g where g.updated_at >= now()-interval '3 days'
  )
  select row_number() over(order by score desc,display_name asc),display_name,score,actor_type
  from all_scores where score>0 order by score desc,display_name asc limit least(greatest(coalesce(p_limit,30),1),100);
$$;

drop function public.get_official_questions();
drop function public.get_official_leaderboard(integer);
drop function public.submit_official_answer(text,text,uuid,smallint);
revoke all on function public.set_basic_guest_nickname(uuid,text) from public, anon, authenticated;
revoke all on function public.start_basic_test(text,text) from public, anon, authenticated;
revoke all on function public.submit_basic_answer(text,text,uuid,uuid,smallint) from public, anon, authenticated;
grant execute on function public.get_basic_leaderboard(integer) to anon, authenticated;
revoke all on function public.get_basic_leaderboard(integer) from public;
grant execute on function public.set_basic_guest_nickname(uuid,text) to service_role;
grant execute on function public.start_basic_test(text,text) to service_role;
grant execute on function public.submit_basic_answer(text,text,uuid,uuid,smallint) to service_role;

create type public.room_state as enum ('active','archived');
alter table public.rooms
  add column goal text,
  add column d_day date,
  add column template_key text,
  add column study_style text,
  add column duration_minutes smallint,
  add column state public.room_state not null default 'active',
  add column archived_at timestamptz,
  add column last_activity_at timestamptz not null default now();
update public.rooms set goal=title where kind='personal' and goal is null;
alter table public.rooms add constraint personal_room_goal check (kind <> 'personal' or (goal is not null and char_length(goal) between 1 and 120));
alter table public.rooms add constraint room_duration check (duration_minutes is null or duration_minutes in (20,40,60));
alter table public.rooms add constraint room_archive_shape check ((state='active' and archived_at is null) or state='archived');

create table public.curricula (
  id uuid primary key default gen_random_uuid(), room_id uuid not null unique references public.rooms(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 100), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(), curriculum_id uuid not null references public.curricula(id) on delete cascade,
  position smallint not null check(position>0), title text not null check(char_length(title) between 1 and 120), status text not null default 'todo' check(status in('todo','doing','done')),
  created_at timestamptz not null default now(), unique(curriculum_id,position)
);
create trigger curricula_updated_at before update on public.curricula for each row execute function public.set_updated_at();
alter table public.curricula enable row level security; alter table public.curriculum_items enable row level security;
grant select on public.curricula,public.curriculum_items to authenticated;
create policy curricula_owner_select on public.curricula for select to authenticated using(exists(select 1 from public.rooms r where r.id=room_id and r.owner_id=auth.uid() and r.kind='personal' and r.deleted_at is null));
create policy curriculum_items_owner_select on public.curriculum_items for select to authenticated using(exists(select 1 from public.curricula c join public.rooms r on r.id=c.room_id where c.id=curriculum_id and r.owner_id=auth.uid() and r.kind='personal' and r.deleted_at is null));

create or replace function public.create_personal_room(p_goal text,p_d_day date default null,p_template_key text default null,p_study_style text default null,p_duration_minutes smallint default null)
returns public.rooms language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid(); v_goal text:=trim(p_goal); v_room public.rooms; v_curriculum uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_goal)<1 or char_length(v_goal)>120 then raise exception 'INVALID_GOAL'; end if;
  if p_d_day is not null and p_d_day < current_date then raise exception 'INVALID_D_DAY'; end if;
  if p_duration_minutes is not null and p_duration_minutes not in(20,40,60) then raise exception 'INVALID_DURATION'; end if;
  if (select count(*) from public.rooms where owner_id=v_user and kind='personal' and state='active' and deleted_at is null)>=5 then raise exception 'ROOM_LIMIT_REACHED'; end if;
  if exists(select 1 from public.rooms where owner_id=v_user and kind='personal' and created_at>now()-interval '24 hours') then raise exception 'ROOM_CREATE_COOLDOWN'; end if;
  insert into public.rooms(owner_id,kind,title,goal,d_day,template_key,study_style,duration_minutes)
  values(v_user,'personal',left(v_goal,60),v_goal,p_d_day,nullif(trim(p_template_key),''),nullif(trim(p_study_style),''),p_duration_minutes)
  returning * into v_room;
  insert into public.curricula(room_id,title) values(v_room.id,'기본 학습 틀') returning id into v_curriculum;
  insert into public.curriculum_items(curriculum_id,position,title) values
    (v_curriculum,1,'오늘의 목표와 범위 확인'),(v_curriculum,2,'핵심 개념 학습'),(v_curriculum,3,'복습 또는 문제 풀이');
  return v_room;
end;
$$;
grant execute on function public.create_personal_room(text,date,text,text,smallint) to authenticated;
revoke all on function public.create_personal_room(text,date,text,text,smallint) from public,anon;
revoke insert on public.rooms from authenticated;

create or replace function private.archive_inactive_personal_rooms() returns void language sql security definer set search_path=public,private as $$
  update public.rooms set state='archived',archived_at=now() where kind='personal' and state='active' and deleted_at is null and last_activity_at<now()-interval '14 days';
$$;
select cron.schedule('studyworld-personal-room-archive','23 * * * *','select private.archive_inactive_personal_rooms();');

create type private.support_status as enum('open','reviewing','closed');
create table private.support_tickets(
  id uuid primary key default gen_random_uuid(), actor_type text not null check(actor_type in('member','guest')), actor_id text not null,
  member_id uuid references auth.users(id) on delete set null, category text not null check(category in('account','materials','commons','feature','other')),
  title text not null check(char_length(title) between 2 and 80), body text not null check(char_length(body) between 10 and 1500),
  status private.support_status not null default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_actor_recent_idx on private.support_tickets(actor_type,actor_id,created_at desc);
create or replace function public.submit_support_ticket(p_actor_type text,p_actor_id text,p_member_id uuid,p_category text,p_title text,p_body text)
returns uuid language plpgsql security definer set search_path=private,public as $$
declare v_id uuid;
begin
  if p_actor_type not in('member','guest') then raise exception 'INVALID_ACTOR'; end if;
  if p_category not in('account','materials','commons','feature','other') then raise exception 'INVALID_CATEGORY'; end if;
  if (select count(*) from private.support_tickets where actor_type=p_actor_type and actor_id=p_actor_id and created_at>now()-interval '10 minutes')>=5 then raise exception 'RATE_LIMITED'; end if;
  insert into private.support_tickets(actor_type,actor_id,member_id,category,title,body)
  values(p_actor_type,p_actor_id,p_member_id,p_category,trim(p_title),trim(p_body)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_support_ticket(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_support_ticket(text,text,uuid,text,text,text) to service_role;
