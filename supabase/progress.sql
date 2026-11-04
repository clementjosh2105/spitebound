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
