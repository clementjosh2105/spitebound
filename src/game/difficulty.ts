import type { Level } from './levels';
export type Difficulty = 'easy' | 'hard' | 'nightmare';
export const difficulties: {id:Difficulty;label:string;description:string}[] = [
 {id:'easy',label:'Easy',description:'Earlier trap warnings, smaller spikes, and forgiving jumps.'},
 {id:'hard',label:'Hard',description:'Fast machinery, short laser gaps, three boss volleys, and a time limit.'},
 {id:'nightmare',label:'Better kill yourself',description:'Relentless hazards, four boss volleys, tight deadlines, and no checkpoints.'}
];
export function configureDifficulty(base:Level, mode:Difficulty):Level {
 const easy=mode==='easy', nightmare=mode==='nightmare';
 return {...base,
 platforms:base.platforms.map(p=>({...p,collapseMs:p.collapse?(easy?450:nightmare?25:60):p.collapseMs})),
 hazards:base.hazards.map(h=>({...h,width:easy?Math.round(h.width*.72):Math.min(145,h.width+(nightmare?18:8)),triggerX:h.triggerX===undefined?undefined:h.x-(easy?140:nightmare?18:40)})),
 spikeDelay:easy?180:nightmare?15:45,
 coyoteTime:easy?.13:nightmare?.025:.06,jumpBuffer:easy?.16:nightmare?.04:.075,
 movingHazards:[...(base.movingHazards??[]).map(h=>({...h,period:Math.round(h.period*(easy?1.3:nightmare?.7:.85))})),...(easy||base.boss||base.id>40?[]:[{x:170,period:nightmare?1300:1800,phase:0},...(nightmare&&!(base.movingHazards?.length)?[{x:base.id===2?690:base.id===10?650:850,period:1350,phase:.5}]:[])])],
 chase:base.chase?{...base.chase,speed:base.chase.speed*(easy?.75:nightmare?1.7:1.15)}:undefined,
 boss:base.boss?{...base.boss,plates:[...base.boss.plates],attackInterval:Math.round(base.boss.attackInterval*(easy?1.4:nightmare?.7:1)),warningMs:easy?950:nightmare?400:500,strikeWidth:easy?80:nightmare?145:125,volleys:easy?1:nightmare?4:3}:undefined,
 checkpoint:nightmare?undefined:base.checkpoint,
 timeLimit:easy?undefined:Math.max(35,Math.ceil(base.par*(nightmare?1.8:2.5))),
 lifts:base.lifts?.map(l=>({...l,period:Math.round(l.period*(easy?1:nightmare?.65:.8))})),
 conveyors:base.conveyors?.map(c=>({...c,speed:c.speed*(easy?1:nightmare?1.75:1.3)})),
 lasers:base.lasers?.map(l=>({...l,onMs:easy?Math.round(l.onMs*.75):Math.max(l.onMs,l.period-(nightmare?500:750))})),
 par:Math.round(base.par*(easy?1.4:nightmare?1.1:1.2)),
 hint:base.hint+(easy||base.boss||base.id>40?'':' Watch the moving skulls: pass underneath when they rise.'),
 lesson:base.lesson+(easy||base.boss||base.id>40?'':' Moving skulls follow a fixed rhythm. Wait for them to rise before passing.')
 };
}
