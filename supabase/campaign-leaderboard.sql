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
