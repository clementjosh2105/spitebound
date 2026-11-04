import { test, expect } from '@playwright/test';
test('boss objectives render different targets and survival has no seals',async({page})=>{
 await page.goto('/tests/game-harness.html');await page.waitForFunction(()=>!!(window as any).qa);
 const states=await page.evaluate(async()=>{const qa=(window as any).qa,states=[];for(const id of [5,10,15,20]){await qa.start(id,'easy');const s=qa.state.scene;const start=s.bossPlates.map((p:any)=>({x:p.x,y:p.y}));for(let tick=0;tick<30&&!s.ended;tick++)qa.state.game.step(tick*1000/60,1000/60);states.push({id,mechanic:qa.state.config.boss.mechanic,start,end:s.bossPlates.map((p:any)=>({x:p.x,y:p.y})),hits:s.bossHits});}return states;});
 expect(states[0].start.every((p:any)=>p.y===438)).toBeTruthy();expect(states[1].start.every((p:any)=>p.y===330)).toBeTruthy();expect(states[1].hits).toBe(0);expect(states[2].start).toEqual([]);expect(states[2].hits).toBe(0);expect(states[3].end).not.toEqual(states[3].start);
});
