/** A seal can be hit once, in order, while standing on it. */
export function advanceSeal(plates:number[],hits:number,x:number,grounded:boolean):number {
 return grounded&&hits<plates.length&&Math.abs(x-plates[hits])<25?hits+1:hits;
}
import type { Boss } from './levels';
export function bossTargets(pattern:Boss['pattern'],target:number,phase:number):number[]{
 const clamp=(x:number)=>Math.max(80,Math.min(880,x));
 switch(pattern){
 case 'echo':return [clamp(target),clamp(960-target)];
 case 'spiral':return [200+phase*220,clamp(target),780-phase*180];
 case 'double':return [clamp(target),clamp(target<480?target+200:target-200)];
 case 'sweep':return [220+phase*240];
 case 'crossfire':return [clamp(target-170),clamp(target+170)];
 case 'quake':return [240,480,720];
 case 'chaos':return phase===0?[clamp(target),clamp(target<480?target+200:target-200)]:phase===1?[240,480,720]:[clamp(target-170),clamp(target+170)];
 default:return [clamp(target)];
 }
}
