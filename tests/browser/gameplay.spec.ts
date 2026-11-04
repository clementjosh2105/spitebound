import { expansionRoutes } from './expansion-routes';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
test('browser physics checks all configured routes and reports failures with positions',async({page})=>{
 test.setTimeout(360000);await page.goto('/tests/game-harness.html');await page.waitForFunction(()=>!!(window as any).qa);const count=await page.evaluate(()=>(window as any).qa.levelCount);const failures:unknown[]=[];const cases:unknown[]=[];
 for(const mode of process.env.GAMEPLAY_MODE?[process.env.GAMEPLAY_MODE]:['easy','hard','nightmare'])for(let id=Number(process.env.GAMEPLAY_FROM)||1;id<=count;id++){
 const result=await page.evaluate(async({id,mode,route})=>{const qa=(window as any).qa;const attempts=[];for(const [attempt,margin] of [42,38,46,50,34,55,60,30,26,22,18,65,70].entries()){await qa.start(id,mode);const state=qa.state;if(!state.config.boss)for(let i=0;i<attempt*15;i++)state.game.step(i*1000/60,1000/60);state.gates=new Set();let waypoint=0;let wasJump=false;let stuck=0,lastX=85;for(let tick=0;tick<4200&&!state.scene.ended;tick++){
 const s=state.scene,c=state.config,p=s.player,b=p.body;let goal=c.exit,avoid=false,jump=false;const grounded=s.inverted?b.blocked.up:(b.blocked.down||b.touching.down);let climb=false;
 if(c.gravityZones&&!s.inverted&&b.blocked.down&&p.x>650&&p.y>420)state.gravitySettled=true;
 if(c.movingExit&&s.exitMoved)goal=c.movingExit.targetX;
 if(c.switch&&!s.opened)goal=c.switch;
 if(c.crate&&!s.crateReady)goal=c.crate.target+35;else if(c.switchSequence&&s.sequenceHits<c.switchSequence.length)goal=c.switchSequence[s.sequenceHits];
 if(c.gravityZones&&p.x>650&&!state.gravitySettled){goal=p.x;avoid=true;}
 if(c.boss&&s.bossHits<c.boss.plates.length){goal=s.bossPlates[s.bossHits]?.x??480;const strikes=s.bossStrikes.filter((x:any)=>x.active);if(strikes.length){const safe=Array.from({length:41},(_,i)=>80+i*20).filter(x=>strikes.every((a:any)=>Math.abs(x-a.x)>a.width/2+25)).sort((a,z)=>(Math.abs(a-p.x)+.6*Math.abs(a-c.boss.plates[s.bossHits])+(Math.sign(a-p.x)!==Math.sign(b.velocity.x)?25:0))-(Math.abs(z-p.x)+.6*Math.abs(z-c.boss.plates[s.bossHits])+(Math.sign(z-p.x)!==Math.sign(b.velocity.x)?25:0)));goal=safe[0]??90;avoid=true;}}
 const crossingSpike=s.spikes.some((h:any)=>h.active&&!h.disarmed&&p.x>h.x-16&&p.x<h.x+h.width+16);const braking=!crossingSpike&&Math.sign(goal-p.x)===Math.sign(b.velocity.x)&&Math.abs(goal-p.x)<b.velocity.x*b.velocity.x/4800+6;let direction=Math.abs(goal-p.x)<8||braking?0:Math.sign(goal-p.x);
 for(const skull of s.movingSkulls){if(p.x>skull.x+80)state.gates.delete('s'+skull.x+':1');if(p.x<skull.x-80)state.gates.delete('s'+skull.x+':-1');if(grounded&&direction&&((direction>0&&skull.x>p.x&&skull.x-p.x<70)||(direction<0&&skull.x<p.x&&p.x-skull.x<70))&&!state.gates.has('s'+skull.x+':'+direction)){if(skull.y>285||skull.body.velocity.y>0){direction=0;avoid=true;}else state.gates.add('s'+skull.x+':'+direction);}}
 if(grounded&&direction&&!c.boss){for(const hazard of c.hazards){const dist=direction>0?hazard.x-p.x:p.x-(hazard.x+hazard.width);if(dist<120&&dist>0&&!state.gates.has('h'+hazard.x+':'+direction)){for(const skull of s.movingSkulls){if(skull.x>=hazard.x-20&&skull.x<=hazard.x+hazard.width+90){const gate=skull.getData('hazard');const arrival=s.elapsed+Math.abs(skull.x-p.x)/280+.07;const ys=[-.1,0,.1].map(offset=>345+78*Math.sin(2*Math.PI*((arrival+offset)*1000/gate.period+gate.phase)));if(Math.max(...ys)>300){direction=0;avoid=true;}else state.gates.add('h'+hazard.x+':'+direction);}}}}}
 if(grounded&&direction&&!c.boss){for(const fake of [...(c.fakeExits??[]),...(s.crateReady&&s.crate?[s.crate.x]:[])]){const dist=(fake-p.x)*direction;if(dist<200&&dist>95&&!state.gates.has('f'+fake+':'+direction)){for(const skull of s.movingSkulls){if(Math.abs(skull.x-fake)<120){const gate=skull.getData('hazard');const arrival=s.elapsed+Math.abs(skull.x-p.x)/280+.07;const ys=[-.1,0,.1].map(offset=>345+78*Math.sin(2*Math.PI*((arrival+offset)*1000/gate.period+gate.phase)));if(Math.max(...ys)>300){direction=0;avoid=true;}else state.gates.add('f'+fake+':'+direction);}}}}}
 if(grounded&&direction&&!c.boss){for(const platform of c.platforms){if(!platform.collapse||state.gates.has('p'+platform.x))continue;const dist=direction>0?platform.x-p.x:p.x-(platform.x+platform.width);if(dist<=0||dist>60)continue;for(const skull of s.movingSkulls){if(skull.x<platform.x||skull.x>platform.x+platform.width+120)continue;const gate=skull.getData('hazard');const arrival=s.elapsed+Math.abs(skull.x-p.x)/280+.07;const ys=[-.1,0,.1].map(offset=>345+78*Math.sin(2*Math.PI*((arrival+offset)*1000/gate.period+gate.phase)));if(Math.max(...ys)>300){direction=0;avoid=true;}else state.gates.add('p'+platform.x);}}}
 if(!avoid&&grounded&&direction){
 for(const h of s.spikes){if(h.disarmed||h.activateOn==='jump'&&!s.jumpTrapTriggered)continue;if(h.activateOn==='coin'&&!s.gift)continue;if(h.activateOn==='checkpoint'&&!s.checkpointTriggered)continue;const distance=direction>0?h.x-p.x:p.x-(h.x+h.width);if(distance<=margin&&distance>=-10)jump=true;}
 for(const platform of c.platforms){if(platform.collapse){const distance=direction>0?platform.x-p.x:p.x-(platform.x+platform.width);if(distance<15&&distance>=-20)jump=true;}}
 for(const fake of [...(c.fakeExits??[]),...(s.crateReady&&s.crate?[s.crate.x]:[])]){const distance=(fake-p.x)*direction;if(distance<95&&distance>50)jump=true;}
 for(const bait of [c.coin,c.fakeCheckpoint])if(bait){const distance=(bait-p.x)*direction;if(distance<75&&distance>35)jump=true;}
 if(c.invisibleWall&&Math.abs(c.invisibleWall-p.x)<75&&Math.abs(c.invisibleWall-p.x)>25)jump=true;
 }
 if(route&&(!c.boss||s.bossHits===c.boss.plates.length)){
 let point=route[Math.min(waypoint,route.length-1)];const lift=point.lift===undefined?undefined:s.lifts[point.lift]?.art;
 if(point.spring){if(b.velocity.y< -600){waypoint++;point=route[Math.min(waypoint,route.length-1)];}}
 else if(point.lift!==undefined&&!point.ride){if(lift&&Math.abs(p.y-(lift.y-9))<10&&(b.blocked.down||b.touching.down)&&Math.abs(p.x-lift.x)<lift.width/2){waypoint++;point=route[Math.min(waypoint,route.length-1)];}}
 else if(Math.abs(p.x-point.x)<24&&(point.climb?p.y<=point.y&&p.y>point.y-15:Math.abs(p.y-point.y)<18)&&(grounded||s.climbing)){waypoint++;point=route[Math.min(waypoint,route.length-1)];}
 goal=point.x;jump=false;direction=Math.abs(goal-p.x)<8?0:Math.sign(goal-p.x);
 const brake=Math.sign(goal-p.x)===Math.sign(b.velocity.x)&&Math.abs(goal-p.x)<b.velocity.x*b.velocity.x/4800+5;if(brake)direction=0;
 if(point.climb){if(Math.abs(p.x-point.x)<16){direction=0;climb=p.y>point.y+1;}else climb=false;}
 else if(point.lift!==undefined){const platform=s.lifts[point.lift].art;const onLift=Math.abs(p.y-(platform.y-9))<12&&(b.blocked.down||b.touching.down)&&Math.abs(p.x-platform.x)<platform.width/2+6;
 if(point.ride||onLift){goal=platform.x;direction=Math.abs(goal-p.x)<8?0:Math.sign(goal-p.x);}
 else{const dist=platform.x-p.x;if(grounded&&Math.abs(dist)<180&&Math.abs(p.y-(platform.y-9))<65)jump=true;else if(grounded){const support=c.platforms.find((a:any)=>Math.abs(a.y-p.y)<10&&p.x>=a.x&&p.x<=a.x+a.width);if(support&&p.x>support.x+support.width-35)direction=0;}}}
 else if(!point.spring&&grounded&&point.y<p.y-25&&point.y>p.y-100&&Math.abs(goal-p.x)<200)jump=true;
 else if(!point.spring&&grounded){const support=c.platforms.find((a:any)=>Math.abs(a.y-p.y)<10&&p.x>=a.x&&p.x<=a.x+a.width);if(support&&direction>0&&support.x+support.width-p.x<40&&goal>support.x+support.width&&point.y<=p.y)jump=true;}
 for(const beam of s.laserBeams){const a=beam.config;const dist=(a.x-p.x)*direction;if(beam.active&&dist>12&&dist<60&&Math.abs(p.y-a.y)<a.height+30){direction=0;jump=false;}}
 }
 state.input.up=climb;
 if(c.boss&&grounded&&s.bossStrikes.some((strike:any)=>Math.abs(strike.x-p.x)<strike.width/2+45)){const timers=[...s.time._active,...s.time._pendingInsertion].filter((t:any)=>t.delay===c.boss.warningMs);const remaining=Math.min(...timers.map((t:any)=>t.delay-t.elapsed));if(remaining<300&&remaining>40)jump=true;}
 if(c.boss?.mechanic==='airborne'&&s.bossVulnerable&&grounded&&Math.abs(p.x-(s.bossPlates[s.bossHits]?.x??-1000))<35)jump=true;
 if(c.crate&&!s.crateReady)jump=false;
 // Release jump between presses; an input buffer does not auto-bunnyhop.
 if(wasJump)jump=false;state.input.jump=jump;wasJump=jump;const reversed=(!!c.reverseAt&&p.x>=c.reverseAt)||!!c.reverseZones?.some(([a,z]:number[])=>p.x>=a&&p.x<=z);state.input.right=direction*(reversed?-1:1)>0;state.input.left=direction*(reversed?-1:1)<0;
 state.game.step(tick*1000/60,1000/60);
 if(Math.abs(p.x-lastX)<.1)stuck++;else stuck=0;lastX=p.x;if(stuck>1000)break;
 }
 const complete=state.events.some((e:any)=>e.type==='complete');if(complete)return {ok:true,time:state.events.find((e:any)=>e.type==='complete').time,attempts:attempt+1};attempts.push({margin,x:Math.round(state.scene.player.x),y:Math.round(state.scene.player.y),ended:state.scene.ended,cause:state.scene.deathCause,timers:state.scene.time._active.map((t:any)=>({delay:t.delay,elapsed:t.elapsed})),vulnerable:state.scene.bossVulnerable,strikes:state.scene.bossStrikes.length,elapsed:state.scene.elapsed,bossHits:state.scene.bossHits,sequence:state.scene.sequenceHits,waypoint,climbing:state.scene.climbing});}return {ok:false,attempts};},{id,mode,route:expansionRoutes[id]});
 if(id>40)console.log('EXPANSION_ROUTE',mode,id,result.ok?'PASS':JSON.stringify(result.attempts?.[0]));cases.push({id,mode,...result});if(!result.ok)failures.push({id,mode,...result});
 }
 mkdirSync('artifacts',{recursive:true});const hash=createHash('sha256');for(const file of ['src/game/TrapScene.ts','src/game/levels.ts','src/game/difficulty.ts','src/game/boss.ts'])hash.update(readFileSync(file));writeFileSync('artifacts/gameplay-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),engineHash:hash.digest('hex'),browser:'Chromium',method:'Phaser Arcade browser physics, fixed 60Hz clock, input-only route controller with full level knowledge',total:cases.length,passed:cases.length-failures.length,cases},null,2)+'\n');await test.info().attach('route-failures',{body:JSON.stringify(failures,null,2),contentType:'application/json'});const summary=failures.map((f:any)=>`${f.mode}/${f.id}@${f.attempts[0].x},${f.attempts[0].y}`);console.log('ROUTE_FAILURES',JSON.stringify(summary));expect(summary).toEqual([]);
});
