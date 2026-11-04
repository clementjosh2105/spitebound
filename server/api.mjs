import { parseProgress, mergeProgress, freshProgress, completeLevel } from '../src/storage/progress.ts';
import { levels } from '../src/game/levels.ts';
const levelCount=levels.length;
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const derive = promisify(scrypt);
const hash = value => createHash('sha256').update(value).digest('hex');
const passwordHash = async (password,salt) => (await derive(password,Buffer.from(salt,'hex'),64,{N:32768,r:8,p:3,maxmem:64*1024*1024})).toString('hex');
const problem = (status,message) => Object.assign(new Error(message),{status});
const modes = new Set(['easy','hard','nightmare']);
export function createApi({database=process.env.TROLL_DB_PATH||resolve('.data/troll.sqlite'),secureCookies=process.env.NODE_ENV==='production'}={}) {
 if(database!==':memory:'){mkdirSync(dirname(database),{recursive:true,mode:0o700});}
 const db=new DatabaseSync(database);if(database!==':memory:')chmodSync(database,0o600);
 db.exec(`PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,salt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS player_progress(player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,level INTEGER NOT NULL CHECK(level>=1),difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','hard','nightmare')),started INTEGER NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS scores(player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,level INTEGER NOT NULL CHECK(level>=1),difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','hard','nightmare')),time_ms INTEGER NOT NULL CHECK(time_ms BETWEEN 500 AND 86400000),deaths INTEGER NOT NULL CHECK(deaths BETWEEN 0 AND 100000),PRIMARY KEY(player_id,level,difficulty));
 CREATE INDEX IF NOT EXISTS ranked_scores ON scores(level,difficulty,time_ms,deaths);
 CREATE INDEX IF NOT EXISTS run_owners ON runs(player_id,started);`);
 // Preserve existing accounts/runs/records when upgrading the old 30-level schema.
 const legacy=db.prepare("SELECT sql FROM sqlite_master WHERE name='runs'").get()?.sql;
 if(/BETWEEN\s+1\s+AND\s+30/i.test(legacy||'')){
 db.exec(`BEGIN IMMEDIATE;
 ALTER TABLE runs RENAME TO legacy_runs;
 CREATE TABLE runs(id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,level INTEGER NOT NULL CHECK(level>=1),difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','hard','nightmare')),started INTEGER NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
 INSERT INTO runs SELECT * FROM legacy_runs;DROP TABLE legacy_runs;
 ALTER TABLE scores RENAME TO legacy_scores;
 CREATE TABLE scores(player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,level INTEGER NOT NULL CHECK(level>=1),difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','hard','nightmare')),time_ms INTEGER NOT NULL CHECK(time_ms BETWEEN 500 AND 86400000),deaths INTEGER NOT NULL CHECK(deaths BETWEEN 0 AND 100000),PRIMARY KEY(player_id,level,difficulty));
 INSERT INTO scores SELECT * FROM legacy_scores;DROP TABLE legacy_scores;
 CREATE INDEX IF NOT EXISTS ranked_scores ON scores(level,difficulty,time_ms,deaths);
 CREATE INDEX IF NOT EXISTS run_owners ON runs(player_id,started);
 PRAGMA user_version=2;COMMIT;`);
 }
 const buckets=new Map();
 function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 function token(req){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('troll_session='))?.slice(14)||'';}
 function player(req){const value=token(req);if(!/^[a-f0-9]{64}$/.test(value))return null;return db.prepare('SELECT p.id,p.email,p.username FROM players p JOIN sessions s ON s.player_id=p.id WHERE s.token_hash=? AND s.expires>?').get(hash(value),Date.now())||null;}
 function session(p){return p?{user:{id:p.id,email:p.email,user_metadata:{username:p.username}}}:null;}
 function issue(req,res,p){const old=token(req);if(old)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(old));const value=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(value),p.id,Date.now()+7*86400000);res.setHeader('Set-Cookie',`troll_session=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=604800${secureCookies?'; Secure':''}`);return session(p);}
 function readProgress(id){const saved=db.prepare('SELECT data FROM player_progress WHERE player_id=?').get(id);let progress=saved?parseProgress(saved.data):freshProgress();
 for(const score of db.prepare('SELECT * FROM scores WHERE player_id=?').all(id)){progress=completeLevel(progress,score.level,score.time_ms/1000,score.deaths,levels[score.level-1].par,score.difficulty);}return progress;}
 function storeProgress(id,progress){db.prepare('INSERT INTO player_progress VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(progress));}
 function checkLevel(level,difficulty){if(!Number.isInteger(level)||level<1||level>levelCount||!modes.has(difficulty))throw problem(400,'Choose a valid level and difficulty.');}
 async function body(req){if(!(req.headers['content-type']||'').startsWith('application/json'))throw problem(415,'Use a JSON request.');if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw problem(403,'Invalid request origin.');}if(origin.host!==req.headers.host)throw problem(403,'Cross-site requests are not allowed.');}let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>(req.url?.startsWith('/api/progress')?65536:8192))throw problem(413,'Request is too large.');chunks.push(chunk);}try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}catch{throw problem(400,'Invalid JSON request.');}}
 function limit(req,path){const key=(req.socket.remoteAddress||'unknown')+path;const now=Date.now();const bucket=buckets.get(key);if(!bucket||bucket.until<now){if(buckets.size>10000)buckets.clear();buckets.set(key,{count:1,until:now+15*60000});}else if(++bucket.count>40)throw problem(429,'Too many attempts. Please try again in a few minutes.');}
 async function handle(req,res){try{
 const url=new URL(req.url,'http://local');const path=url.pathname;
 if(req.method==='GET'&&path==='/api/health')return reply(res,200,{ok:true,provider:'builtin',levels:levelCount});
 if(req.method==='GET'&&path==='/api/auth/session')return reply(res,200,{session:session(player(req))});
 if(req.method==='GET'&&path==='/api/leaderboard'){if(!url.searchParams.has('level')){const difficulty=url.searchParams.get('difficulty');checkLevel(1,difficulty);const rows=db.prepare(`WITH totals AS (
 SELECT s.player_id,p.username,COUNT(*) AS levels_completed,SUM(s.time_ms) AS time_ms,SUM(s.deaths) AS deaths
 FROM scores s JOIN players p ON p.id=s.player_id WHERE s.difficulty=? GROUP BY s.player_id,p.username)
 SELECT *,DENSE_RANK() OVER (ORDER BY levels_completed DESC,time_ms,deaths) AS rank FROM totals ORDER BY levels_completed DESC,time_ms,deaths,player_id LIMIT 50`).all(difficulty);return reply(res,200,{rows});}const level=Number(url.searchParams.get('level')),difficulty=url.searchParams.get('difficulty');checkLevel(level,difficulty);const rows=db.prepare('SELECT s.player_id,p.username,s.time_ms,s.deaths,DENSE_RANK() OVER (ORDER BY s.time_ms) AS rank FROM scores s JOIN players p ON p.id=s.player_id WHERE s.level=? AND s.difficulty=? ORDER BY s.time_ms,s.deaths,s.player_id LIMIT 50').all(level,difficulty);return reply(res,200,{rows});}
 if(req.method==='GET'&&path==='/api/progress'){const p=player(req);if(!p)throw problem(401,'Log in to load your progress.');return reply(res,200,{progress:readProgress(p.id)});}
 if(req.method!=='POST')throw problem(404,'Endpoint not found.');
 const data=await body(req);
 if(path==='/api/auth/signup'||path==='/api/auth/login'){
 limit(req,path);const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';const password=data.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<8||password.length>128)throw problem(400,'Use a valid email and a password with 8–128 characters.');
 if(path.endsWith('/signup')){const username=data.username;if(typeof username!=='string'||!/^[a-zA-Z0-9_]{3,24}$/.test(username))throw problem(400,'Player names need 3–24 letters, numbers or underscores.');const salt=randomBytes(16).toString('hex'),digest=await passwordHash(password,salt);const p={id:randomUUID(),email,username};try{db.prepare('INSERT INTO players VALUES(?,?,?,?,?)').run(p.id,email,username,digest,salt);}catch(e){if(String(e).includes('UNIQUE'))throw problem(409,'That email or player name is already registered.');throw e;}return reply(res,201,{session:issue(req,res,p)});}
 const p=db.prepare('SELECT * FROM players WHERE email=?').get(email);const digest=await passwordHash(password,p?.salt||'00000000000000000000000000000000');if(!p||!timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(p.password_hash,'hex')))throw problem(401,'Email or password is incorrect.');return reply(res,200,{session:issue(req,res,p)});
 }
 if(path==='/api/auth/logout'){const value=token(req);if(value)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(value));res.setHeader('Set-Cookie',`troll_session=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies?'; Secure':''}`);return reply(res,200,{ok:true});}
 if(path==='/api/auth/reset'||path==='/api/auth/update-password')throw problem(503,'Password-reset email delivery is not configured on this server. Your existing login still works.');
 const p=player(req);if(!p)throw problem(401,'Log in before submitting a score.');
 if(path==='/api/progress'){if(!data.progress||typeof data.progress!=='object'||Array.isArray(data.progress))throw problem(400,'Provide valid progress.');const progress=mergeProgress(readProgress(p.id),parseProgress(JSON.stringify(data.progress)));storeProgress(p.id,progress);return reply(res,200,{progress});}
 if(path==='/api/runs/start'){checkLevel(data.level,data.difficulty);db.prepare('DELETE FROM runs WHERE player_id=? AND started<?').run(p.id,Date.now()-86400000);const count=db.prepare('SELECT COUNT(*) AS n FROM runs WHERE player_id=? AND started>?').get(p.id,Date.now()-3600000).n;if(count>=300)throw problem(429,'Too many runs. Please try again later.');const id=randomUUID();db.prepare('INSERT INTO runs(id,player_id,level,difficulty,started) VALUES(?,?,?,?,?)').run(id,p.id,data.level,data.difficulty,Date.now());return reply(res,201,{id});}
 if(path==='/api/runs/finish'){
 if(typeof data.run!=='string'||!Number.isInteger(data.time_ms)||data.time_ms<500||data.time_ms>86400000||!Number.isInteger(data.deaths)||data.deaths<0||data.deaths>100000)throw problem(400,'Invalid completion data.');
 db.exec('BEGIN IMMEDIATE');try{const run=db.prepare('SELECT * FROM runs WHERE id=? AND player_id=?').get(data.run,p.id);if(!run||run.finished)throw problem(409,'Run missing or already submitted.');if(data.time_ms>Date.now()-run.started+1000)throw problem(400,'Completion time exceeds this run’s duration.');db.prepare('INSERT INTO scores VALUES(?,?,?,?,?) ON CONFLICT(player_id,level,difficulty) DO UPDATE SET time_ms=excluded.time_ms,deaths=excluded.deaths WHERE excluded.time_ms<scores.time_ms OR (excluded.time_ms=scores.time_ms AND excluded.deaths<scores.deaths)').run(p.id,run.level,run.difficulty,data.time_ms,data.deaths);storeProgress(p.id,completeLevel(readProgress(p.id),run.level,data.time_ms/1000,data.deaths,levels[run.level-1].par,run.difficulty));db.prepare('UPDATE runs SET finished=1 WHERE id=?').run(run.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return reply(res,200,{ok:true});
 }
 throw problem(404,'Endpoint not found.');
 }catch(e){if(!res.headersSent)reply(res,e.status||500,{error:e.status?e.message:'The server could not complete the request.'});else res.end();}}
 return {handle,close:()=>db.close()};
}
