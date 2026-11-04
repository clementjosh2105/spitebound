import { createLocalClient } from './local-online';
export type { PlayerUser } from './local-online';
import { createClient } from '@supabase/supabase-js';
import type { Difficulty } from '../game/difficulty';
const env=(import.meta as ImportMeta & {env:Record<string,string>}).env;
export const online=env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY):createLocalClient();
export const onlineProvider=env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_PUBLISHABLE_KEY?'supabase':'builtin';
export type LeaderboardRow={player_id:string;username:string;time_ms:number;deaths:number;rank:number;levels_completed:number};
export async function beginOnlineRun(level:number,difficulty:Difficulty):Promise<string|null>{if(!online)return null;const {data,error}=await online.rpc('begin_run',{p_level:level,p_difficulty:difficulty});if(error)throw error;return data;}
export async function finishOnlineRun(run:string,time:number,deaths:number){if(!online)return;const {error}=await online.rpc('finish_run',{p_run:run,p_time_ms:Math.round(time*1000),p_deaths:deaths});if(error)throw error;}
export async function fetchLeaderboard(difficulty:Difficulty):Promise<LeaderboardRow[]>{if(!online)return [];const {data,error}=await online.rpc('campaign_leaderboard',{p_difficulty:difficulty});if(error)throw error;return data??[];}

export async function loadOnlineProgress(){const {data,error}=await online.rpc('load_progress',{});if(error)throw error;return data;}
export async function saveOnlineProgress(progress:import('../storage/progress').Progress){const {data,error}=await online.rpc('save_progress',{p_progress:progress});if(error)throw error;return data;}
