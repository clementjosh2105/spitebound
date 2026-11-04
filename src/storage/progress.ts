import type { Difficulty } from '../game/difficulty';
import { levels } from '../game/levels.ts';
const levelCount = levels.length;
export type RecordScore = { time: number; deaths: number; stars: number };
export type Progress = { unlocked: number; deaths: number; scores: Record<number, RecordScore>; sound: boolean; music: boolean; reducedMotion: boolean; difficultyScores?: Partial<Record<Difficulty, Record<number, RecordScore>>> };
export const freshProgress = (): Progress => ({unlocked:1,deaths:0,scores:{},sound:true,music:true,reducedMotion:false});
export function parseProgress(raw: string | null): Progress {
 try { const p = JSON.parse(raw || 'null'); if (!p || typeof p !== 'object') return freshProgress();
 const scores: Progress['scores'] = {};
 for (const [key,s] of Object.entries(p.scores || {})) { const v=s as RecordScore; if (v && +key>=1 && Number.isInteger(+key) && +key<=levelCount && Number.isFinite(v.time) && v.time>=0 && Number.isInteger(v.deaths) && v.deaths>=0 && Number.isInteger(v.stars) && v.stars>=1 && v.stars<=3) scores[+key]=v; }
 const difficultyScores: Progress['difficultyScores'] = {};
 for(const mode of ['easy','hard','nightmare'] as const){const entries=p.difficultyScores?.[mode] ?? (mode==='easy'?scores:{});const valid: Record<number,RecordScore>={};for(const [id,value] of Object.entries(entries)){const v=value as RecordScore;if(v && Number.isInteger(+id)&&+id>=1&&+id<=levelCount&&Number.isFinite(v.time)&&v.time>=0&&Number.isInteger(v.deaths)&&v.deaths>=0&&Number.isInteger(v.stars)&&v.stars>=1&&v.stars<=3)valid[+id]=v;}if(Object.keys(valid).length||p.difficultyScores?.[mode]!==undefined)difficultyScores[mode]=valid;}
 return {...(Object.keys(difficultyScores).length?{difficultyScores}:{}),unlocked:Math.max(1,Math.min(levelCount,Number.isInteger(p.unlocked)?p.unlocked:1),...Object.keys(scores).map(id=>Math.min(levelCount,+id+1))),deaths:Number.isInteger(p.deaths)&&p.deaths>=0?p.deaths:0,scores,sound:p.sound!==false,music:p.music!==false,reducedMotion:p.reducedMotion===true};
 } catch { return freshProgress(); }
}
export function loadProgress(userId?:string): Progress { try { return parseProgress(localStorage.getItem(userId?'troll-trap-v1:'+userId:'troll-trap-v1')); } catch {return freshProgress();} }
export function saveProgress(p: Progress,userId?:string) { try {localStorage.setItem(userId?'troll-trap-v1:'+userId:'troll-trap-v1',JSON.stringify(p));} catch { /* Guest play works without storage. */ } }
export function completeLevel(p: Progress,id:number,time:number,deaths:number,par:number,difficulty:Difficulty='easy'): Progress {
 const stars=deaths===0&&time<=par?3:deaths<=2?2:1;
 const modeScores=p.difficultyScores?.[difficulty] ?? (difficulty==='easy'?p.scores:{});
 const prior=modeScores[id];
 const score={time:Math.min(prior?.time??Infinity,time),deaths:Math.min(prior?.deaths??Infinity,deaths),stars:Math.max(prior?.stars??0,stars)};
 return {...p,unlocked:Math.max(p.unlocked,Math.min(levelCount,id+1)),scores:{...p.scores,[id]:score},difficultyScores:{...(p.difficultyScores??{easy:p.scores}),[difficulty]:{...modeScores,[id]:score}}};
}

// Preserve achievements when two devices save different snapshots. Preferences use the latest save.
export function mergeProgress(previous: Progress, incoming: Progress): Progress {
 const mergeScores=(a:Progress['scores'],b:Progress['scores'])=>{
 const result={...a};for(const [id,score] of Object.entries(b)){const old=result[+id];result[+id]=old?{time:Math.min(old.time,score.time),deaths:Math.min(old.deaths,score.deaths),stars:Math.max(old.stars,score.stars)}:score;}return result;
 };
 const difficultyScores:NonNullable<Progress['difficultyScores']>={};
 for(const mode of ['easy','hard','nightmare'] as const) difficultyScores[mode]=mergeScores(previous.difficultyScores?.[mode]??(mode==='easy'?previous.scores:{}),incoming.difficultyScores?.[mode]??(mode==='easy'?incoming.scores:{}));
 return {...incoming,unlocked:Math.max(previous.unlocked,incoming.unlocked),deaths:Math.max(previous.deaths,incoming.deaths),scores:mergeScores(previous.scores,incoming.scores),difficultyScores};
}
