import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApi } from '../server/api.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
async function setup(t,database=':memory:'){const api=createApi({database,secureCookies:false});const server=createServer(api.handle);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;let closed=false;async function close(){if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));api.close();}t.after(close);async function req(path,data,cookie='',headers={}){const response=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],cookieHeader:response.headers.get('set-cookie')};}return {req,close};}
const credentials={email:'player@example.test',username:'test_player',password:'StrongTestPassword_42'};
test('registration, session restoration, wrong password, and logout use real cookies',async t=>{const {req}=await setup(t);const signup=await req('/api/auth/signup',credentials);assert.equal(signup.status,201);assert.match(signup.cookieHeader,/HttpOnly/);assert.match(signup.cookieHeader,/SameSite=Lax/);assert.equal(signup.data.session.user.user_metadata.username,'test_player');assert.equal(JSON.stringify(signup.data).includes(credentials.password),false);const restored=await req('/api/auth/session',undefined,signup.cookie);assert.equal(restored.data.session.user.id,signup.data.session.user.id);assert.equal((await req('/api/auth/login',{...credentials,password:'WrongPassword_42'})).status,401);const login=await req('/api/auth/login',credentials);assert.equal(login.status,200);await req('/api/auth/logout',{},login.cookie);assert.equal((await req('/api/auth/session',undefined,login.cookie)).data.session,null);});
test('account storage survives a server restart and never stores plaintext passwords',async t=>{const directory=mkdtempSync(join(tmpdir(),'troll-db-test-')),file=join(directory,'accounts.sqlite');t.after(()=>rmSync(directory,{recursive:true,force:true}));const first=await setup(t,file);const created=await first.req('/api/auth/signup',credentials);await first.close();const db=new DatabaseSync(file);const stored=db.prepare('SELECT password_hash,salt FROM players').get();assert.notEqual(stored.password_hash,credentials.password);assert.equal(stored.password_hash.length,128);assert.equal(stored.salt.length,32);db.close();const second=await setup(t,file);assert.equal((await second.req('/api/auth/session',undefined,created.cookie)).data.session.user.email,credentials.email);assert.equal((await second.req('/api/auth/login',credentials)).status,200);await second.close();});
test('scores are shared, mode-filtered, fastest-first, and slower runs cannot overwrite a best',async t=>{const {req}=await setup(t);const a=await req('/api/auth/signup',credentials),b=await req('/api/auth/signup',{...credentials,email:'second@example.test',username:'second_player'});async function submit(cookie,time,deaths,mode='easy'){const run=await req('/api/runs/start',{level:1,difficulty:mode},cookie);return req('/api/runs/finish',{run:run.data.id,time_ms:time,deaths},cookie);}assert.equal((await submit(a.cookie,600,2)).status,200);assert.equal((await submit(a.cookie,900,0)).status,200);assert.equal((await submit(b.cookie,500,1)).status,200);await submit(a.cookie,700,3,'hard');const board=await req('/api/leaderboard?level=1&difficulty=easy');assert.equal(board.data.rows.length,2);assert.deepEqual((await req('/api/leaderboard?level=1&difficulty=easy',undefined,a.cookie)).data.rows,board.data.rows);assert.deepEqual((await req('/api/leaderboard?level=1&difficulty=easy',undefined,b.cookie)).data.rows,board.data.rows);assert.equal(board.data.rows[0].username,'second_player');assert.equal(board.data.rows[0].rank,1);assert.equal(board.data.rows[1].time_ms,600);assert.equal(board.data.rows[1].deaths,2);assert.equal('email' in board.data.rows[0],false);assert.equal((await req('/api/leaderboard?level=1&difficulty=hard')).data.rows.length,1);});
test('one-time run tokens are owned by their player and guests cannot post',async t=>{const {req}=await setup(t);const a=await req('/api/auth/signup',credentials),b=await req('/api/auth/signup',{...credentials,email:'second@example.test',username:'second_player'});assert.equal((await req('/api/runs/start',{level:1,difficulty:'easy'})).status,401);const run=await req('/api/runs/start',{level:1,difficulty:'easy'},a.cookie);const score={run:run.data.id,time_ms:500,deaths:0};assert.equal((await req('/api/runs/finish',score,b.cookie)).status,409);assert.equal((await req('/api/runs/finish',score,a.cookie)).status,200);assert.equal((await req('/api/runs/finish',score,a.cookie)).status,409);assert.equal((await req('/api/runs/start',{level:61,difficulty:'easy'},a.cookie)).status,400);assert.equal((await req('/api/runs/start',{level:1,difficulty:'invalid'},a.cookie)).status,400);});
test('duplicate accounts, cross-site writes, and brute-force requests are rejected',async t=>{const {req}=await setup(t);assert.equal((await req('/api/auth/signup',credentials)).status,201);assert.equal((await req('/api/auth/signup',credentials)).status,409);assert.equal((await req('/api/auth/login',credentials,'',{Origin:'https://attacker.example'})).status,403);for(let i=0;i<40;i++)await req('/api/auth/login',{email:'invalid',password:'short'});assert.equal((await req('/api/auth/login',credentials)).status,429);});

test('online runs accept the last configured level and reject levels outside the campaign',async t=>{const {req}=await setup(t);const p=await req('/api/auth/signup',credentials);const run=await req('/api/runs/start',{level:60,difficulty:'nightmare'},p.cookie);assert.equal(run.status,201);assert.equal((await req('/api/runs/finish',{run:run.data.id,time_ms:500,deaths:0},p.cookie)).status,200);assert.equal((await req('/api/leaderboard?level=60&difficulty=nightmare')).data.rows[0].username,credentials.username);});

test('upgrading a thirty-level database preserves sessions and records and unlocks new online levels',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'troll-migration-')),file=join(directory,'accounts.sqlite');
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const first=await setup(t,file),created=await first.req('/api/auth/signup',credentials);
 const run=await first.req('/api/runs/start',{level:30,difficulty:'easy'},created.cookie);
 await first.req('/api/runs/finish',{run:run.data.id,time_ms:500,deaths:2},created.cookie);
 await first.close();
 const db=new DatabaseSync(file);
 for(const name of ['runs','scores']){
  const sql=db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql.replace('CHECK(level>=1)','CHECK(level BETWEEN 1 AND 30)');
  db.exec(`ALTER TABLE ${name} RENAME TO old_${name};${sql};INSERT INTO ${name} SELECT * FROM old_${name};DROP TABLE old_${name};`);
 }
 db.close();
 const second=await setup(t,file);
 assert.equal((await second.req('/api/auth/session',undefined,created.cookie)).data.session.user.email,credentials.email);
 assert.equal((await second.req('/api/leaderboard?level=30&difficulty=easy')).data.rows[0].time_ms,500);
 const next=await second.req('/api/runs/start',{level:40,difficulty:'easy'},created.cookie);
 assert.equal(next.status,201);
 assert.equal((await second.req('/api/runs/finish',{run:next.data.id,time_ms:500,deaths:0},created.cookie)).status,200);
 await second.close();
});

test('per-user progress survives restart, merges achievements, and is private',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'troll-progress-')),file=join(directory,'accounts.sqlite');t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const first=await setup(t,file),a=await first.req('/api/auth/signup',credentials),b=await first.req('/api/auth/signup',{...credentials,email:'other@example.test',username:'other_player'});
 assert.equal((await first.req('/api/progress')).status,401);assert.equal((await first.req('/api/progress',{progress:{unlocked:40}})).status,401);
 const progress={unlocked:8,deaths:12,sound:false,music:false,reducedMotion:true,scores:{7:{time:12,deaths:1,stars:2}},difficultyScores:{hard:{7:{time:12,deaths:1,stars:2}}}};
 assert.equal((await first.req('/api/progress',{progress},a.cookie)).status,200);
 assert.equal((await first.req('/api/progress',undefined,b.cookie)).data.progress.unlocked,1);
 await first.req('/api/progress',{progress:{...progress,unlocked:2,deaths:2,scores:{7:{time:20,deaths:3,stars:1}}}},a.cookie);
 const saved=(await first.req('/api/progress',undefined,a.cookie)).data.progress;assert.equal(saved.unlocked,8);assert.equal(saved.deaths,12);assert.equal(saved.scores[7].time,12);assert.equal(saved.sound,false);
 // Campaign saves cannot manufacture a public leaderboard record.
 assert.equal((await first.req('/api/leaderboard?level=7&difficulty=hard')).data.rows.length,0);
 await first.close();const second=await setup(t,file);assert.deepEqual((await second.req('/api/progress',undefined,a.cookie)).data.progress,saved);
 const run=await second.req('/api/runs/start',{level:10,difficulty:'easy'},a.cookie);assert.equal((await second.req('/api/runs/finish',{run:run.data.id,time_ms:500,deaths:0},a.cookie)).status,200);
 const completed=(await second.req('/api/progress',undefined,a.cookie)).data.progress;assert.equal(completed.unlocked,11);assert.equal(completed.difficultyScores.easy[10].time,.5);
});

test('campaign leaderboard combines levels once per player and ranks completion before time and deaths',async t=>{
 const {req}=await setup(t);const players=[];for(const name of ['alpha','bravo','charlie'])players.push(await req('/api/auth/signup',{email:`${name}@example.test`,username:name,password:credentials.password}));
 async function submit(player,level,time,deaths,difficulty='easy'){const run=await req('/api/runs/start',{level,difficulty},player.cookie);assert.equal((await req('/api/runs/finish',{run:run.data.id,time_ms:time,deaths},player.cookie)).status,200);}
 await submit(players[0],1,600,2);await submit(players[0],2,600,1);await submit(players[0],1,900,0);
 await submit(players[1],1,500,0);await submit(players[2],1,500,0);await submit(players[2],3,700,1);await submit(players[0],1,500,0,'hard');
 const board=await req('/api/leaderboard?difficulty=easy');assert.equal(board.status,200);assert.deepEqual(board.data.rows.map(row=>[row.username,row.levels_completed,row.time_ms,row.deaths,row.rank]),[['charlie',2,1200,1,1],['alpha',2,1200,3,2],['bravo',1,500,0,3]]);
 assert.deepEqual((await req('/api/leaderboard?difficulty=easy',undefined,players[1].cookie)).data.rows,board.data.rows);assert.equal('email' in board.data.rows[0],false);
 const hard=await req('/api/leaderboard?difficulty=hard');assert.equal(hard.data.rows.length,1);assert.equal(hard.data.rows[0].levels_completed,1);assert.equal(hard.data.rows[0].time_ms,500);assert.equal((await req('/api/leaderboard?difficulty=unknown')).status,400);
});
