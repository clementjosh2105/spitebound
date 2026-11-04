import Phaser from 'phaser';
import { TrapScene, type Controls, type GameEvent } from '../src/game/TrapScene';
import { levels } from '../src/game/levels';
import { configureDifficulty, type Difficulty } from '../src/game/difficulty';
let game:Phaser.Game|null=null;
(window as any).qa={levelCount:levels.length,
 async start(id:number,mode:Difficulty){if(game){game.destroy(true);game.step(0,16.6667);}const input:Controls={left:false,right:false,jump:false};const config=configureDifficulty(levels[id-1],mode);const events:GameEvent[]=[];const scene=new TrapScene(config,input,e=>events.push(e),false,true);const runtime=scene as any;const die=runtime.die.bind(runtime);runtime.die=(reason?:string)=>{runtime.deathCause={player:{x:runtime.player.body.x,y:runtime.player.body.y,width:runtime.player.body.width,height:runtime.player.body.height},strikes:runtime.bossStrikes.map((s:any)=>({x:s.body.x,y:s.body.y,w:s.body.width,enabled:s.body.enable})),skulls:runtime.movingSkulls.map((s:any)=>({x:s.body.x,y:s.body.y,w:s.body.width,enabled:s.body.enable})),spikes:runtime.spikes.filter((s:any)=>s.body.body.enable).map((s:any)=>({x:s.body.body.x,w:s.body.body.width}))};die(reason);};game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:960,height:540,pixelArt:true,physics:{default:'arcade',arcade:{gravity:{x:0,y:1400},debug:false}},scene:[scene],audio:{noAudio:true},banner:false});await new Promise(resolve=>setTimeout(resolve,60));game.loop.stop();(window as any).qa.state={scene,input,config,events,game};},
 simulate(frames:number,decision:(state:any)=>void){const state=(window as any).qa.state;for(let i=0;i<frames&&!state.scene.ended;i++){decision(state);state.game.step(performance.now()+i*1000/60,1000/60);}return state.events;}
};
