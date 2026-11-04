-- For an existing Supabase installation; preserves all accounts and records.
begin;
alter table public.game_runs drop constraint if exists game_runs_level_check;
alter table public.game_runs add constraint game_runs_level_check check(level between 1 and 40);
alter table public.level_scores drop constraint if exists level_scores_level_check;
alter table public.level_scores add constraint level_scores_level_check check(level between 1 and 40);
create or replace function public.begin_run(p_level integer,p_difficulty text) returns uuid language plpgsql security definer set search_path='' as $$ declare run_id uuid; begin
 if auth.uid() is null then raise exception 'Sign in to submit scores';end if;
 if p_level not between 1 and 40 or p_difficulty not in ('easy','hard','nightmare') then raise exception 'Invalid level or difficulty';end if;
 delete from public.game_runs where player_id=auth.uid() and started_at<now()-interval '1 day';
 insert into public.game_runs(player_id,level,difficulty) values(auth.uid(),p_level,p_difficulty) returning id into run_id;return run_id;end; $$;

commit;
