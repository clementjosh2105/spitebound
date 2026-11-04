import { test, expect } from '@playwright/test';
async function enterExpandedCampaign(page:import('@playwright/test').Page){
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest',exact:true}).click();await page.evaluate(()=>{const guest=JSON.parse(sessionStorage.getItem('troll-trap-guest')!);localStorage.setItem('troll-trap-v1:'+guest.id,JSON.stringify({unlocked:60,deaths:0,scores:{}}));localStorage.setItem('troll-trap-tutorial:'+guest.id,'seen');});await page.reload();await page.getByRole('button',{name:'Level map',exact:true}).first().click();
}
test('completion identifies the completed level and updates its map node',async({page})=>{
 await page.route('**/src/game/TrapScene.ts*',route=>route.fulfill({contentType:'application/javascript',body:`import Phaser from '/node_modules/.vite/deps/phaser.js';export class TrapScene extends Phaser.Scene{constructor(config,controls,onEvent){super('play');setTimeout(()=>onEvent({type:'complete',time:12}),100);}create(){}}`}));
 await enterExpandedCampaign(page);await page.getByRole('button',{name:'Level 41: Upward Mobility',exact:true}).click();await page.getByRole('button',{name:'Start level'}).click();
 await expect(page.getByText('LEVEL 41 COMPLETE · Upward Mobility')).toBeVisible();await expect(page.getByText('1 / 60 levels completed')).toBeVisible();await expect(page.getByRole('button',{name:'Next level 42'})).toBeVisible();await page.getByRole('button',{name:'Back to level selection'}).click();await expect(page.getByRole('button',{name:'Level 41: Upward Mobility',exact:true})).toHaveClass(/node-cleared/);
});
test('phone climbing controls fit the viewport and new worlds render',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await enterExpandedCampaign(page);await expect(page.getByLabel('Skyworks level map')).toBeVisible();await expect(page.getByLabel('Clockwork Citadel level map')).toBeVisible();await page.getByRole('button',{name:'Level 41: Upward Mobility',exact:true}).click();await page.getByRole('button',{name:'Start level'}).click();await page.getByRole('button',{name:'Continue in portrait'}).click();
 for(const name of ['Move left','Move right','Climb up','Climb down','Jump']){const control=page.getByRole('button',{name,exact:true});await expect(control).toBeVisible();const rect=await control.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(390);}
 await page.screenshot({path:'artifacts/expansion-phone.png'});await context.close();
});
test('vertical camera shows a smaller character and follows the tower',async({page})=>{
 await page.goto('/tests/game-harness.html');await page.waitForFunction(()=>!!(window as any).qa);await page.evaluate(async()=>{await (window as any).qa.start(49,'easy');});
 await page.screenshot({path:'artifacts/expansion-tower.png'});const camera=await page.evaluate(()=>{const scene=(window as any).qa.state.scene;return {zoom:scene.cameras.main.zoom,scroll:scene.cameras.main.scrollY};});expect(camera.zoom).toBe(.8);expect(camera.scroll).toBeGreaterThan(200);
});

test('hard deadline kills an idle run and explains the failure',async({page})=>{
 await page.goto('/tests/game-harness.html');await page.waitForFunction(()=>!!(window as any).qa);
 const result=await page.evaluate(async()=>{const qa=(window as any).qa;await qa.start(1,'hard');const state=qa.state;for(let tick=0;tick<5000&&!state.scene.ended;tick++)state.game.step(tick*1000/60,1000/60);return {limit:state.config.timeLimit,death:state.events.find((event:any)=>event.type==='death')};});
 expect(result.limit).toBeGreaterThan(0);expect(result.death.reason).toContain('Time ran out.');expect(result.death.time).toBeGreaterThanOrEqual(result.limit);
});

test('Spitebound branding and browser icons are configured and load',async({page})=>{
 await page.goto('/');await expect(page).toHaveTitle(/Spitebound/);await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href','/icon.svg');
 const manifest=await (await page.request.get('/site.webmanifest')).json();expect(manifest.name).toBe('Spitebound');for(const icon of manifest.icons)expect((await page.request.get(icon.src)).ok()).toBeTruthy();expect((await page.request.get('/apple-touch-icon.png')).ok()).toBeTruthy();expect((await page.request.get('/favicon.ico')).ok()).toBeTruthy();
 await page.getByRole('button',{name:'Continue as guest',exact:true}).click();await expect(page.getByRole('heading',{name:'SPITEBOUND'})).toBeVisible();await expect(page.locator('header .brand')).toContainText('SPITEBOUND');expect(await page.locator('header img.brand-icon').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBeTruthy();
});
