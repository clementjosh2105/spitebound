-- For an existing Supabase installation; preserves all accounts and records.
begin;
alter table public.game_runs drop constraint if exists game_runs_level_check;
alter table public.game_runs add constraint game_runs_level_check check(level between 1 and 60);
alter table public.level_scores drop constraint if exists level_scores_level_check;
alter table public.level_scores add constraint level_scores_level_check check(level between 1 and 60);
create or replace function public.begin_run(p_level integer,p_difficulty text) returns uuid language plpgsql security definer set search_path='' as $$ declare run_id uuid; begin
 if auth.uid() is null then raise exception 'Sign in to submit scores';end if;
 if p_level not between 1 and 60 or p_difficulty not in ('easy','hard','nightmare') then raise exception 'Invalid level or difficulty';end if;
 delete from public.game_runs where player_id=auth.uid() and started_at<now()-interval '1 day';
 insert into public.game_runs(player_id,level,difficulty) values(auth.uid(),p_level,p_difficulty) returning id into run_id;return run_id;end; $$;

commit;

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
