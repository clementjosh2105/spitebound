import { test, expect } from '@playwright/test';
const red='rgb(255, 107, 107)';
test('account failure turns red and subsequent success restores the original color',async({page})=>{
 let failed=true;
 await page.route('**/api/auth/signup',route=>route.fulfill({status:failed?409:200,json:failed?{error:'That email is already registered.'}:{session:null}}));
 await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();
 await page.getByLabel('Player name',{exact:true}).fill('TestPlayer');await page.getByLabel('Email',{exact:true}).fill('test@example.test');await page.getByLabel('Password',{exact:true}).fill('Password1234');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('alert')).toHaveCSS('color',red);
 failed=false;await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('status')).toContainText('Check your email');await expect(page.getByRole('status')).not.toHaveCSS('color',red);
});
test('leaderboard error is red and refresh recovers',async({page})=>{
 let failed=true;await page.route('**/api/leaderboard?*',route=>route.fulfill({status:failed?503:200,json:failed?{error:'Unavailable'}:{rows:[]}}));
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest',exact:true}).click();await page.getByRole('button',{name:'Leaderboard',exact:true}).click();await expect(page.getByRole('alert')).toHaveCSS('color',red);
 failed=false;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByText('No times yet')).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('score submission retry keeps the run token and restores success color',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 // Complete a scene immediately to exercise the real app submission UI without solving a level.
 await page.route('**/src/game/TrapScene.ts*',route=>route.fulfill({contentType:'application/javascript',body:`import Phaser from '/node_modules/.vite/deps/phaser.js';export class TrapScene extends Phaser.Scene{constructor(config,controls,onEvent){super('play');this.onEvent=onEvent;setTimeout(()=>onEvent({type:'complete',time:1}),100);}create(){}}`}));
 await page.route('**/api/auth/session',route=>route.fulfill({json:{session:{user:{id:'message-test',email:'test@example.test',user_metadata:{username:'Tester'}}}}}));
 await page.route('**/api/progress',route=>route.fulfill({json:{progress:{}}}));
 await page.route('**/api/runs/start',route=>route.fulfill({json:{id:'original-run'}}));
 const submissions:unknown[]=[];let failed=true;
 await page.route('**/api/runs/finish',async route=>{submissions.push(route.request().postDataJSON());if(!failed)await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({status:failed?503:200,json:failed?{error:'Unable to reach rankings. Check your connection.'}:{ok:true}});});
 await page.goto('/');await page.getByRole('button',{name:'Let’s play'}).click();await page.getByRole('button',{name:'Start level'}).click();await page.getByRole('button',{name:'Got it. Let’s play'}).click();
 await expect.poll(()=>({errors,submissions:submissions.length})).toEqual({errors:[],submissions:1});await expect(page.getByRole('alert')).toHaveCSS('color',red);await expect(page.getByRole('alert')).toContainText('Your local progress is saved.');
 failed=false;await page.getByRole('button',{name:'Retry score submission',exact:true}).click();await expect(page.getByRole('button',{name:'Retry score submission',exact:true})).toHaveCount(0);
 await expect(page.locator('.score-status')).toContainText('Run submitted.');await expect(page.locator('.score-status')).not.toHaveCSS('color',red);expect(submissions).toEqual([{run:'original-run',time_ms:1000,deaths:0},{run:'original-run',time_ms:1000,deaths:0}]);
});

test('level failure message and retry button are red',async({page})=>{
 await page.route('**/src/game/TrapScene.ts*',route=>route.fulfill({contentType:'application/javascript',body:`import Phaser from '/node_modules/.vite/deps/phaser.js';export class TrapScene extends Phaser.Scene{constructor(config,controls,onEvent){super('play');setTimeout(()=>onEvent({type:'death',time:1}),100);}create(){}}`}));
 await page.goto('/');await page.getByRole('button',{name:'Continue as guest',exact:true}).click();await page.getByRole('button',{name:'Let’s play'}).click();await page.getByRole('button',{name:'Start level'}).click();await page.getByRole('button',{name:'Got it. Let’s play'}).click();
 await expect(page.getByRole('heading',{name:'Well, that happened.'})).toHaveCSS('color',red);
 await expect(page.locator('.death-modal .modal-icon')).toHaveCSS('color',red);await expect(page.locator('.death-modal .eyebrow')).toHaveCSS('color',red);await expect(page.locator('.death-modal p')).toHaveCSS('color',red);await expect(page.getByRole('button',{name:'Try again'})).toHaveCSS('background-color',red);
});
