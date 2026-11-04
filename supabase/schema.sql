-- Run once in the Supabase SQL editor. Use the public/publishable key in Vite.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade,username text not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'));
create table public.game_runs (id uuid primary key default gen_random_uuid(),player_id uuid not null references public.profiles(id) on delete cascade,level integer not null check(level between 1 and 60),difficulty text not null check(difficulty in ('easy','hard','nightmare')),started_at timestamptz not null default now(),finished boolean not null default false);
create table public.level_scores (player_id uuid not null references public.profiles(id) on delete cascade,level integer not null check(level between 1 and 60),difficulty text not null check(difficulty in ('easy','hard','nightmare')),time_ms integer not null check(time_ms between 500 and 86400000),deaths integer not null check(deaths between 0 and 100000),primary key(player_id,level,difficulty));
insert into public.profiles(id,username) select id,case when (raw_user_meta_data->>'username') ~ '^[a-zA-Z0-9_]{3,24}$' then raw_user_meta_data->>'username' else 'player_'||substr(id::text,1,8) end from auth.users on conflict(id) do nothing;
create index leaderboard_times on public.level_scores(level,difficulty,time_ms,deaths);
alter table public.profiles enable row level security;
alter table public.game_runs enable row level security;
alter table public.level_scores enable row level security;
-- No direct browser table writes. Only the bounded RPCs below write scores.
revoke all on public.profiles,public.game_runs,public.level_scores from anon,authenticated;
create function public.create_player_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.profiles(id,username) values(new.id,coalesce(new.raw_user_meta_data->>'username','player_'||substr(new.id::text,1,8)));return new;end; $$;
create trigger create_player after insert on auth.users for each row execute function public.create_player_profile();
create function public.begin_run(p_level integer,p_difficulty text) returns uuid language plpgsql security definer set search_path='' as $$ declare run_id uuid; begin
 if auth.uid() is null then raise exception 'Sign in to submit scores';end if;
 if p_level not between 1 and 60 or p_difficulty not in ('easy','hard','nightmare') then raise exception 'Invalid level or difficulty';end if;
 delete from public.game_runs where player_id=auth.uid() and started_at<now()-interval '1 day';
 insert into public.game_runs(player_id,level,difficulty) values(auth.uid(),p_level,p_difficulty) returning id into run_id;return run_id;end; $$;
create function public.finish_run(p_run uuid,p_time_ms integer,p_deaths integer) returns void language plpgsql security definer set search_path='' as $$ declare r public.game_runs; begin
 select * into r from public.game_runs where id=p_run and player_id=auth.uid() for update;
 if not found or r.finished then raise exception 'Run missing or already submitted';end if;
 if p_time_ms is null or p_time_ms<500 or p_time_ms>86400000 or p_deaths is null or p_deaths<0 or p_deaths>100000 or p_time_ms>extract(epoch from (now()-r.started_at))*1000+1000 then raise exception 'Invalid completion';end if;
 insert into public.level_scores(player_id,level,difficulty,time_ms,deaths) values(r.player_id,r.level,r.difficulty,p_time_ms,p_deaths)
 on conflict(player_id,level,difficulty) do update set time_ms=excluded.time_ms,deaths=excluded.deaths where (excluded.time_ms,excluded.deaths)<(level_scores.time_ms,level_scores.deaths);
 update public.game_runs set finished=true where id=p_run;end; $$;
create function public.level_leaderboard(p_level integer,p_difficulty text) returns table(player_id uuid,username text,time_ms integer,deaths integer,rank bigint) language sql stable security definer set search_path='' as $$
 select s.player_id,p.username,s.time_ms,s.deaths,dense_rank() over(order by s.time_ms) from public.level_scores s join public.profiles p on p.id=s.player_id where s.level=p_level and s.difficulty=p_difficulty order by s.time_ms,s.deaths,s.player_id limit 50; $$;
revoke all on function public.create_player_profile() from public;
revoke all on function public.begin_run(integer,text),public.finish_run(uuid,integer,integer),public.level_leaderboard(integer,text) from public;
grant execute on function public.begin_run(integer,text),public.finish_run(uuid,integer,integer) to authenticated;
grant execute on function public.level_leaderboard(integer,text) to anon,authenticated;

-- Run for existing installations to enable per-account cloud saves.
begin;
create table if not exists public.player_progress(player_id uuid primary key references public.profiles(id) on delete cascade,data jsonb not null default '{}'::jsonb);
alter table public.player_progress enable row level security;
revoke all on public.player_progress from anon,authenticated;
create or replace function public.merge_score_maps(a jsonb,b jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(coalesce(x.key,y.key),case when x.value is null then y.value when y.value is null then x.value else jsonb_build_object('time',least((x.value->>'time')::numeric,(y.value->>'time')::numeric),'deaths',least((x.value->>'deaths')::integer,(y.value->>'deaths')::integer),'stars',greatest((x.value->>'stars')::integer,(y.value->>'stars')::integer)) end),'{}'::jsonb)
 from jsonb_each(coalesce(a,'{}'::jsonb)) x full join jsonb_each(coalesce(b,'{}'::jsonb)) y on x.key=y.key;
$$;
create or replace function public.load_progress() returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;begin
 if auth.uid() is null then raise exception 'Log in to load progress';end if;
 select data into saved from public.player_progress where player_id=auth.uid();
 return coalesce(saved,'{}'::jsonb);end;$$;
create or replace function public.save_progress(p_progress jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old jsonb; merged jsonb; modes jsonb='{}'::jsonb; mode text;begin
 if auth.uid() is null then raise exception 'Log in to save progress';end if;
 if jsonb_typeof(p_progress)<>'object' or octet_length(p_progress::text)>65536 then raise exception 'Invalid progress';end if;
 insert into public.player_progress(player_id) values(auth.uid()) on conflict do nothing;
 select data into old from public.player_progress where player_id=auth.uid() for update;
 foreach mode in array array['easy','hard','nightmare'] loop
 modes=modes||jsonb_build_object(mode,public.merge_score_maps(old->'difficultyScores'->mode,p_progress->'difficultyScores'->mode));end loop;
 merged=p_progress||jsonb_build_object('unlocked',least(60,greatest(1,coalesce((old->>'unlocked')::integer,1),coalesce((p_progress->>'unlocked')::integer,1))),'deaths',greatest(0,coalesce((old->>'deaths')::integer,0),coalesce((p_progress->>'deaths')::integer,0)),'scores',public.merge_score_maps(old->'scores',p_progress->'scores'),'difficultyScores',modes);
 update public.player_progress set data=merged where player_id=auth.uid();return merged;end;$$;
revoke all on function public.merge_score_maps(jsonb,jsonb),public.load_progress(),public.save_progress(jsonb) from public;
grant execute on function public.load_progress(),public.save_progress(jsonb) to authenticated;
commit;

-- Aggregate the best submitted record for every level at the chosen difficulty.
create or replace function public.campaign_leaderboard(p_difficulty text)
returns table(player_id uuid,username text,levels_completed bigint,time_ms bigint,deaths bigint,rank bigint)
language sql stable security definer set search_path='' as $$
 with totals as (
 select s.player_id,p.username,count(*) as levels_completed,sum(s.time_ms) as time_ms,sum(s.deaths) as deaths
 from public.level_scores s join public.profiles p on p.id=s.player_id
 where s.difficulty=p_difficulty group by s.player_id,p.username
 )
 select t.player_id,t.username,t.levels_completed,t.time_ms,t.deaths,
 dense_rank() over(order by t.levels_completed desc,t.time_ms,t.deaths)
 from totals t order by t.levels_completed desc,t.time_ms,t.deaths,t.player_id limit 50;
$$;
revoke all on function public.campaign_leaderboard(text) from public;
grant execute on function public.campaign_leaderboard(text) to anon,authenticated;
