import type { PlayerUser as User } from './services/online';
import { Account } from './components/Account';
import { Leaderboard } from './components/Leaderboard';
import { online, beginOnlineRun, finishOnlineRun, loadOnlineProgress, saveOnlineProgress } from './services/online';
import { unlockAudio } from './game/audio';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Phaser from 'phaser';
import { TrapScene, type Controls, type GameEvent } from './game/TrapScene';
import { LevelMap } from './components/LevelMap';
import { levels, worldForLevel } from './game/levels';
import { configureDifficulty, difficulties, type Difficulty } from './game/difficulty';
import { loadProgress, saveProgress, completeLevel, freshProgress, parseProgress, mergeProgress } from './storage/progress';
import './styles.css';
function HudIcon({name}:{name:'hint'|'fullscreen'|'restart'|'pause'|'play'}){
 const paths={hint:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 18h.01',fullscreen:'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',restart:'M20 7v5h-5M20 12a8 8 0 1 0-2 5',pause:'M8 5v14M16 5v14',play:'M8 5l11 7-11 7Z'};
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function App(){
 const [deathReason,setDeathReason]=useState('');
 const [tutorial,setTutorial]=useState<{id:number;mode:Difficulty}|null>(null);const [portraitDismissed,setPortraitDismissed]=useState(false);

 const checkpoint=useRef({x:85,time:0});const onlineRunRef=useRef<Promise<string|null>|null>(null);
 const retryScore=useRef<(()=>void)|null>(null);const [scoreFailed,setScoreFailed]=useState(false);
 const [progressError,setProgressError]=useState(''),[progressReload,setProgressReload]=useState(0);const saveQueue=useRef(Promise.resolve());const lastSavedProgress=useRef<ReturnType<typeof freshProgress>|null>(null);
 const applyIdentity=useRef<(next:User|null)=>void>(()=>{});
 const [authReady,setAuthReady]=useState(false);const [progressOwner,setProgressOwner]=useState<string|null>(null);
 const [user,setUser]=useState<User|null>(null),[accountOpen,setAccountOpen]=useState(false),[recovery,setRecovery]=useState(false),[scoreStatus,setScoreStatus]=useState('');const userRef=useRef<User|null>(null);
 useEffect(()=>{
 let active=true;
 function applySession(next:User|null){if(!active)return;if(userRef.current?.id!==next?.id){
 controls.current={left:false,right:false,jump:false,up:false,down:false};game.current?.destroy(true);game.current=null;
 onlineRunRef.current=null;checkpoint.current={x:85,time:0};setRun(0);setScreen('home');setView('game');setSelected(1);setTime(0);setDeaths(0);setPendingLevel(null);setTutorial(null);setSettings(false);setHint(false);setScoreStatus('');setAccountOpen(false);
 setProgress(next?loadProgress(next.id):freshProgress());setProgressOwner(next?.id.startsWith('guest:')?next.id:null);setProgressError('');
 }userRef.current=next;setUser(next);setAuthReady(true);}
 applyIdentity.current=applySession;
 void online.auth.getSession().then(({data})=>{let guest:User|null=null;try{guest=JSON.parse(sessionStorage.getItem('troll-trap-guest')||'null');if(!guest?.id?.startsWith('guest:'))guest=null;}catch{}applySession(data.session?.user??guest);}).catch(()=>applySession(null));
 const {data}=online.auth.onAuthStateChange((event,session)=>{applySession(session?.user??null);if(event==='PASSWORD_RECOVERY'){setRecovery(true);setAccountOpen(true);}});
 return()=>{active=false;data.subscription.unsubscribe();};
 },[]);
 const [view,setView]=useState<'game'|'map'|'leaderboard'>('game');const gameShell=useRef<HTMLElement>(null);
 const [difficulty,setDifficulty]=useState<Difficulty>('hard');const [pendingDifficulty,setPendingDifficulty]=useState<Difficulty>('hard');const [pendingLevel,setPendingLevel]=useState<number|null>(null);
 const [progress,setProgress]=useState(freshProgress);const [selected,setSelected]=useState(1);const [run,setRun]=useState(0);const [screen,setScreen]=useState<'home'|'playing'|'paused'|'dead'|'won'>('home');const [settings,setSettings]=useState(false);const [hint,setHint]=useState(false);const [time,setTime]=useState(0);const [deaths,setDeaths]=useState(0);const [reversed,setReversed]=useState(false);const timeDisplayRef=useRef<HTMLSpanElement>(null);const reversedRef=useRef(false);
 const host=useRef<HTMLDivElement>(null),game=useRef<Phaser.Game|null>(null),controls=useRef<Controls>({left:false,right:false,jump:false,up:false,down:false});const current=configureDifficulty(levels[selected-1],difficulty);const difficultyLabel=difficulties.find(d=>d.id===difficulty)!.label;
 useEffect(()=>{if(!user||user.id.startsWith('guest:'))return;let live=true;setProgressError('');
 void loadOnlineProgress().then(async data=>{if(!live||userRef.current?.id!==user.id)return;const merged=mergeProgress(loadProgress(user.id),parseProgress(JSON.stringify(data)));await saveOnlineProgress(merged);if(live){lastSavedProgress.current=merged;setProgress(merged);setProgressOwner(user.id);}}).catch(()=>{if(live)setProgressError('Could not load your saved progress. Check your connection and retry.');});return()=>{live=false;};},[user?.id,progressReload]);
 useEffect(()=>{if(!user||progressOwner!==user.id)return;saveProgress(progress,user.id);if(user.id.startsWith('guest:')||lastSavedProgress.current===progress)return;
 const owner=user.id;const timer=setTimeout(()=>{saveQueue.current=saveQueue.current.then(async()=>{if(userRef.current?.id!==owner)return;try{await saveOnlineProgress(progress);if(userRef.current?.id===owner){lastSavedProgress.current=progress;setProgressError('');}}catch{if(userRef.current?.id===owner)setProgressError('Could not sync progress. Your device has a backup. Retry saving when connected.');}});},300);return()=>clearTimeout(timer);},[progress,user?.id,progressOwner]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>game.current?.scale.refresh());window.scrollTo(0,0);return()=>cancelAnimationFrame(frame);},[view,run]);
 useEffect(()=>{if(view==='game'&&(screen==='playing'||screen==='dead'||screen==='won'))game.current?.scene.resume('play');else game.current?.scene.pause('play');controls.current.left=controls.current.right=controls.current.jump=controls.current.up=controls.current.down=false;},[screen,view]);
 useEffect(()=>{
 if(!run||!host.current)return;
 let cancelled=false;let submitting=false;retryScore.current=null;setScoreFailed(false);const competingUser=userRef.current?.id.startsWith('guest:')?undefined:userRef.current?.id;const onlineRun=onlineRunRef.current??(onlineRunRef.current=competingUser?beginOnlineRun(selected,difficulty).catch(()=>null):Promise.resolve(null));setScoreStatus('');
 const scene=new TrapScene(current,controls.current,(event:GameEvent)=>{
 if(event.type==='tick'){if(timeDisplayRef.current){const val=current.timeLimit?Math.max(0,current.timeLimit-event.time):event.time;timeDisplayRef.current.textContent=val.toFixed(1);}if(reversedRef.current!==event.reversed){reversedRef.current=event.reversed;setReversed(event.reversed);}}if(event.type==='checkpoint')checkpoint.current={x:event.x,time:event.time};if(event.type==='death'){setTime(event.time);setDeathReason(event.reason??current.lesson);if(checkpoint.current.x!==85)checkpoint.current.time=event.time;setDeaths(d=>d+1);setProgress(p=>({...p,deaths:p.deaths+1}));setScreen('dead');}if(event.type==='complete'){setTime(event.time);setProgress(p=>completeLevel(p,selected,event.time,deaths,current.par,difficulty));setScreen('won');if(competingUser){
 const submitScore=async()=>{if(cancelled||submitting)return;submitting=true;setScoreFailed(false);setScoreStatus('Submitting score…');
 try{const id=await onlineRun;if(cancelled)return;if(!id){retryScore.current=null;throw new Error('This run could not connect to online rankings. Replay the level to submit a score.');}await finishOnlineRun(id,event.time,deaths);if(!cancelled){retryScore.current=null;setScoreStatus('Run submitted. The leaderboard keeps your best time.');}}
 catch(error){if(!cancelled){setScoreFailed(true);setScoreStatus(`${error instanceof Error?error.message:'Score could not be submitted.'} Your local progress is saved.${retryScore.current?' Retry submission or check the rankings if it was already received.':''}`);}}
 finally{submitting=false;}};
 retryScore.current=()=>{void submitScore();};void submitScore();
 }else setScoreStatus('Log in before your next run to appear on the leaderboard.');}
 },progress.sound,progress.reducedMotion,progress.music,checkpoint.current.x,checkpoint.current.time);
 const isMobile=typeof navigator!=='undefined'&&(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||window.innerWidth<800);
 game.current=new Phaser.Game({type:Phaser.AUTO,parent:host.current,width:isMobile?960:1280,height:isMobile?540:720,pixelArt:true,backgroundColor:'#171c2d',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'arcade',arcade:{gravity:{x:0,y:1400},debug:false}},scene:[scene],audio:{noAudio:true}});
 return()=>{cancelled=true;retryScore.current=null;game.current?.destroy(true);game.current=null;};
 },[run]);
 useEffect(()=>{
 const handleKeyDown=(e:KeyboardEvent)=>{
 if(e.target instanceof HTMLInputElement)return;
 if(screen==='playing'){
 if(e.code==='ArrowLeft'||e.code==='KeyA'){controls.current.left=true;}
 if(e.code==='ArrowRight'||e.code==='KeyD'){controls.current.right=true;}
 if(e.code==='ArrowUp'||e.code==='KeyW'){controls.current.up=true;}
 if(e.code==='ArrowDown'||e.code==='KeyS'){controls.current.down=true;}
 if(e.code==='Space'){controls.current.jump=true;e.preventDefault();}
 }
 if(e.code==='Escape'&&pendingLevel===null&&!settings&&!accountOpen&&!tutorial){setScreen(s=>s==='playing'?'paused':s==='paused'?'playing':s);}
 if(e.code==='KeyR'&&screen!=='home'&&pendingLevel===null&&!settings&&!accountOpen&&!tutorial)retry();
 };
 const handleKeyUp=(e:KeyboardEvent)=>{
 if(e.code==='ArrowLeft'||e.code==='KeyA'){controls.current.left=false;}
 if(e.code==='ArrowRight'||e.code==='KeyD'){controls.current.right=false;}
 if(e.code==='ArrowUp'||e.code==='KeyW'){controls.current.up=false;}
 if(e.code==='ArrowDown'||e.code==='KeyS'){controls.current.down=false;}
 if(e.code==='Space'){controls.current.jump=false;}
 };
 const blur=()=>{controls.current.left=controls.current.right=controls.current.jump=controls.current.up=controls.current.down=false;setScreen(s=>s==='playing'?'paused':s);};
 window.addEventListener('keydown',handleKeyDown);window.addEventListener('keyup',handleKeyUp);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',blur);
 return()=>{window.removeEventListener('keydown',handleKeyDown);window.removeEventListener('keyup',handleKeyUp);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur);};
 },[screen,selected,pendingLevel,settings,accountOpen,tutorial]);
 function start(id:number){setPendingDifficulty(difficulty);setPendingLevel(id);setScreen(s=>s==='playing'?'paused':s);}
 function begin(id:number,mode:Difficulty=difficulty,skipTutorial=false){let seen=false;try{seen=localStorage.getItem('troll-trap-tutorial:'+userRef.current?.id)==='seen';}catch{}if(!skipTutorial&&!seen){setTutorial({id,mode});return;}if(skipTutorial){try{localStorage.setItem('troll-trap-tutorial:'+userRef.current?.id,'seen');}catch{}}setTutorial(null);unlockAudio();checkpoint.current={x:85,time:0};onlineRunRef.current=null;setView('game');setDifficulty(mode);setPendingLevel(null);setSelected(id);setDeaths(0);setTime(0);setHint(false);setReversed(false);setScreen('playing');setRun(r=>r+1);}
 function retry(){if(screen==='won'){checkpoint.current={x:85,time:0};onlineRunRef.current=null;}setTime(checkpoint.current.time);setReversed(false);setScreen('playing');setRun(r=>r+1);}
 function restartBeginning(){checkpoint.current={x:85,time:0};onlineRunRef.current=null;setDeaths(0);retry();}
 function leaveFullscreen(){if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});}
 function openMap(){leaveFullscreen();setView('map');setScreen(s=>s==='playing'?'paused':s);}
 function openLeaderboard(){leaveFullscreen();setView('leaderboard');setScreen(s=>s==='playing'?'paused':s);}
 function enterGuest(){const bytes=crypto.getRandomValues(new Uint8Array(16));const adjectives=['Sneaky','Wobbly','Lucky','Cheeky','Dizzy','Brave','Bouncy','Clever'];const creatures=['Goblin','Gecko','Panda','Fox','Otter','Frog','Raven','Raccoon'];const username=adjectives[bytes[0]%adjectives.length]+creatures[bytes[1]%creatures.length]+'_'+Array.from(bytes.slice(2,5),byte=>byte.toString(16).padStart(2,'0')).join('');const guest:User={id:'guest:'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join(''),email:'',user_metadata:{username}};try{sessionStorage.setItem('troll-trap-guest',JSON.stringify(guest));}catch{}applyIdentity.current(guest);}
 function logout(){if(userRef.current?.id.startsWith('guest:')){try{sessionStorage.removeItem('troll-trap-guest');}catch{}applyIdentity.current(null);}else void online.auth.signOut().then(({error})=>{if(error)window.alert('Could not log out. Please check your connection.');else{try{sessionStorage.removeItem('troll-trap-guest');}catch{}}});}
 function showAccount(){setScreen(s=>s==='playing'?'paused':s);setAccountOpen(true);}
 function showGame(){setView('game');}
 function toggleFullscreen(){if(document.fullscreenElement)void document.exitFullscreen();else void gameShell.current?.requestFullscreen?.().catch(()=>{});}
 function home(){leaveFullscreen();setView('map');setPendingLevel(null);setScreen('home');game.current?.destroy(true);game.current=null;}
 function touch(key:keyof Controls,label:string){return <button className={'touch '+key} aria-label={label} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);controls.current[key]=true;}} onPointerUp={()=>controls.current[key]=false} onPointerCancel={()=>controls.current[key]=false} onLostPointerCapture={()=>controls.current[key]=false}>{key==='left'?'←':key==='right'?'→':key==='down'?'⇩':'↑'}<small>{key==='jump'?'JUMP':''}</small></button>;}
 if(!authReady)return <div className="login-screen" role="status">Restoring your session…</div>;
 if(user&&progressOwner!==user.id)return <div className="login-screen"><div className="modal">{progressError?<><p className="message-error" role="alert">{progressError}</p><button className="secondary" onClick={()=>setProgressReload(n=>n+1)}>Retry loading progress</button><button className="text-button" onClick={logout}>Log out</button></>:<p role="status">Loading your saved progress…</p>}</div></div>;
 if(!user)return <Account standalone onGuest={enterGuest} onClose={()=>{}}/>;
 return <div className={`app focused-app ${view!=='game'?'map-view':screen==='home'?'menu-view':'playing-view'}`}>
 {(view!=='game'||screen==='home')&&<header><a className="brand" href="#" onClick={e=>{e.preventDefault();home();}}><img className="brand-icon" src="/icon.svg" alt="" width="30" height="30"/> SPITE<span className="lime">BOUND</span><span className="beta">BETA</span></a><nav><button onClick={showGame} className={view==='game'?'nav-current':''}>Play</button><button onClick={openMap} className={view==='map'?'nav-current':''}>Level map</button><button onClick={openLeaderboard} className={view==='leaderboard'?'nav-current':''}>Leaderboard</button><button onClick={()=>{setSettings(true);setScreen(s=>s==='playing'?'paused':s);}}>Settings <span>⚙</span></button>{user?<button onClick={logout} title="Sign out">{user.user_metadata.username??'Player'} · Log out</button>:<button className="login-button" onClick={showAccount}>Log in</button>}</nav></header>}
 {progressError&&<div className="progress-sync-error" role="alert">{progressError}<button className="secondary" onClick={()=>{const owner=user.id;saveQueue.current=saveQueue.current.then(async()=>{if(userRef.current?.id!==owner)return;try{await saveOnlineProgress(progress);if(userRef.current?.id===owner){lastSavedProgress.current=progress;setProgressError('');}}catch{}});}}>Retry saving progress</button></div>}
 <main>
 <section ref={gameShell} className="game-section" hidden={view!=='game'} aria-label="Game"><div className="game-toolbar"><div className="world-tag"><span>{String(worldForLevel(selected).id).padStart(2,'0')}</span><div>{screen==='home'?'SPITEBOUND':`LEVEL ${selected} · ${current.name}`}<small>{worldForLevel(selected).name} · {difficulty==='nightmare'?'Nightmare':difficultyLabel}</small></div></div><div className="stats">{screen!=='home'&&<button className="icon-button hint-button" aria-label={hint?'Hide hint':'Show hint'} onClick={()=>setHint(h=>!h)}><HudIcon name="hint"/></button>}{document.fullscreenEnabled&&<button className="icon-button fullscreen-button" aria-label="Toggle fullscreen" onClick={toggleFullscreen}><HudIcon name="fullscreen"/></button>}<div><small>DEATHS</small><strong>{String(screen==='home'?progress.deaths:deaths).padStart(2,'0')} <span>☠</span></strong></div><div><small>{screen!=='home'&&current.timeLimit?'LEFT':'TIME'}</small><strong><span ref={timeDisplayRef}>{(screen!=='home'&&current.timeLimit?Math.max(0,current.timeLimit-time):time).toFixed(1)}</span><span>s</span></strong></div><button className="icon-button" aria-label="Restart level" disabled={screen==='home'} onClick={retry}><HudIcon name="restart"/></button><button className="icon-button" aria-label={screen==='paused'?'Resume game':'Pause game'} disabled={screen==='home'||screen==='dead'||screen==='won'} onClick={()=>setScreen(s=>s==='playing'?'paused':'playing')}><HudIcon name={screen==='paused'?'play':'pause'}/></button></div></div>
 <div className="game-stage" tabIndex={0} onClick={()=>{window.focus();host.current?.querySelector('canvas')?.focus();}}><div ref={host} className="canvas-host"/>
 {screen==='home'&&<div className="home-scene"><div className="pixel-stars"/><div className="mountains"/><div className="pixel-door"><span>EXIT</span></div><div className="pixel-floor"/><div className="home-card"><div className="small-label">A VERTICAL TEST OF WILL</div><h2>SPITE<span>BOUND</span></h2><p>Every step fights back.</p><button className="primary" onClick={()=>start(progress.unlocked)}>{progress.scores[1]?'Continue the chaos':'Let’s play'} <span>→</span></button><button className="text-button" onClick={openMap}>Explore the level map →</button></div><div className="stage-badge">✦ 100% FREE TO RAGE</div></div>}
 {screen==='playing'&&!portraitDismissed&&<aside className="landscape-prompt">Rotate your phone for a wider view.<button onClick={()=>setPortraitDismissed(true)}>Continue in portrait ×</button></aside>}
 {screen!=='home'&&<div className="level-badge">LEVEL {String(selected).padStart(2,'0')} / {String(levels.length).padStart(2,'0')} {reversed&&<span> • CONTROLS REVERSED</span>}</div>}
 {(screen==='dead'||screen==='paused'||screen==='won')&&<div className="overlay"><div className={screen==='dead'?"modal death-modal":"modal"}><div className="modal-icon">{screen==='dead'?'☠':screen==='won'?'★':'Ⅱ'}</div><div className="eyebrow">{screen==='dead'?'AN EDUCATIONAL EXPERIENCE':screen==='won'?`LEVEL ${String(selected).padStart(2,'0')} COMPLETE · ${current.name}`:'TAKE A BREATHER'}</div><h2>{screen==='dead'?'Well, that happened.':screen==='won'?(selected===levels.length?`All ${levels.length} conquered!`:current.boss?'Gatekeeper defeated.':'Suspiciously well done.'):'Chaos on hold.'}</h2><p>{screen==='dead'?(deathReason||current.lesson):screen==='won'?`${time.toFixed(1)} seconds · ${deaths} deaths · ${'★'.repeat(deaths===0&&time<=current.par?3:deaths<=2?2:1)}`:'Your next questionable decision can wait.'}</p>{screen==='won'&&<p className="completion-progress">{Object.keys(progress.scores).length} / {levels.length} levels completed{current.boss?' · Boss defeated':''}</p>}<button className="primary" onClick={()=>screen==='paused'?setScreen('playing'):screen==='dead'?retry():selected<levels.length?begin(selected+1):home()}>{screen==='dead'?'Try again ↻':screen==='paused'?'Resume →':selected<levels.length?`Next level ${selected+1} →`:'Back to levels →'}</button><button className="text-button" onClick={home}>Back to level selection</button>{screen==='paused'&&<button className="text-button" onClick={restartBeginning}>Restart from beginning</button>}{screen==='won'&&<><p className={`score-status${scoreFailed?' message-error':''}`} role={scoreFailed?"alert":"status"}>{scoreStatus}</p>{scoreFailed&&retryScore.current&&<button className="secondary" onClick={()=>retryScore.current?.()}>Retry score submission</button>}<button className="text-button" onClick={openLeaderboard}>View campaign rankings →</button></>}</div></div>}
 </div><div className="game-bottom"><span className="control-reminder">{screen==='home'?`${levels.length} levels · ${Math.ceil(levels.length/10)} worlds · ${levels.filter(l=>l.boss).length} bosses`:'← → / A D move · SPACE jump · R retry · ESC pause'}</span><div><button onClick={openMap}>Level map</button><button onClick={()=>setHint(h=>!h)}>◇ {hint?'Hide hint':'Hint'}</button></div></div>{hint&&<p className="hint">{current.hint}</p>}
 {screen!=='home'&&<div className="touch-controls">{touch('left','Move left')}{touch('right','Move right')}{current.ladders&&<>{touch('up','Climb up')}{touch('down','Climb down')}</>}{touch('jump','Jump')}</div>}
 </section>
 {view==='map'&&<section className="levels-section"><div className="section-title"><div><h3>Your road to ruin<span>01—{String(levels.length).padStart(2,'0')}</span></h3><p>Six worlds. Twelve gatekeepers. Climb, ride, and survive. <button className="difficulty-change" onClick={()=>start(selected)}>Difficulty: {difficultyLabel} ▾</button></p></div><span>{Object.keys(progress.scores).length} / {levels.length} COMPLETED</span></div><LevelMap progress={progress} difficulty={difficulty} selected={selected} onSelect={start}/></section>}
 {view==='leaderboard'&&<Leaderboard initialDifficulty={difficulty} playerId={user?.id} onLogin={showAccount}/>}
 </main>
 {pendingLevel!==null&&<div className="overlay settings-overlay" role="dialog" aria-modal="true" aria-labelledby="difficulty-title"><div className="modal difficulty-modal"><div className="eyebrow">LEVEL {String(pendingLevel).padStart(2,'0')} · CHOOSE YOUR PAIN</div><h2 id="difficulty-title">How bad can it get?</h2><div className="difficulty-options" role="group" aria-label="Difficulty">{difficulties.map(d=><button key={d.id} aria-pressed={pendingDifficulty===d.id} className={pendingDifficulty===d.id?'difficulty-option chosen':'difficulty-option'} onClick={()=>setPendingDifficulty(d.id)}><strong>{d.label}</strong><small>{d.description}</small></button>)}</div><button className="primary" onClick={()=>begin(pendingLevel,pendingDifficulty)}>Start level →</button><button className="text-button" onClick={()=>setPendingLevel(null)}>Cancel</button></div></div>}
 {tutorial&&<div className="overlay settings-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div className="modal tutorial-modal"><div className="eyebrow">BEFORE YOUR FIRST MISTAKE</div><h2 id="tutorial-title">A little training. A lot of traps.</h2><div className="tutorial-controls"><p><strong>Move</strong><span>← → or A / D · touch arrows on phones</span></p><p><strong>Jump</strong><span>Space to jump · W / ↑ climbs ladders · S / ↓ descends</span></p><p><strong>Retry & pause</strong><span>R retries · Esc pauses · screen buttons on phones</span></p></div><p>Press and release jump for each leap. Floor seams and fake doors won’t give the trap away. Some blue flags save checkpoints. Some lie. Bosses become vulnerable after their strikes.</p><p>Your first hint: jump before the floor breaks. Each death teaches the route.</p><button className="primary" onClick={()=>begin(tutorial.id,tutorial.mode,true)}>Got it. Let’s play →</button><button className="text-button" onClick={()=>setTutorial(null)}>Back</button></div></div>}
 {accountOpen&&<Account recovery={recovery} onClose={()=>{setAccountOpen(false);setRecovery(false);}}/>}
 {settings&&<div className="overlay settings-overlay"><div className="modal"><h2>Your rules. Mostly.</h2><label>Sound effects<input type="checkbox" checked={progress.sound} onChange={e=>setProgress(p=>({...p,sound:e.target.checked}))}/></label><button className="text-button" onClick={()=>{setSettings(false);setTutorial({id:selected,mode:difficulty});}}>How to play / restart tutorial</button><label>Music<input type="checkbox" checked={progress.music} onChange={e=>setProgress(p=>({...p,music:e.target.checked}))}/></label><label>Reduce motion<input type="checkbox" checked={progress.reducedMotion} onChange={e=>setProgress(p=>({...p,reducedMotion:e.target.checked}))}/></label><p>Settings apply on the next level or retry. Touch controls appear during play. Landscape is recommended on phones.</p><button className="primary" onClick={()=>setSettings(false)}>Done ✓</button></div></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
