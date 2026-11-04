import Phaser from 'phaser';
import { tone, startMusic } from './audio';
import { advanceSeal, bossTargets } from './boss';
import { worldForLevel } from './levels';
import type { Level, Hazard } from './levels';
export type Controls = { left: boolean; right: boolean; jump: boolean; up?:boolean; down?:boolean };
export type GameEvent = { type: 'tick'; time: number; reversed: boolean } | {type:'death';time:number;reason?:string} | {type:'checkpoint';x:number;time:number} | {type:'complete';time:number};
export class TrapScene extends Phaser.Scene {
 private climbing=false; private hasKey=false; private keyArt?:Phaser.GameObjects.Container;
 private lifts:{art:Phaser.GameObjects.Rectangle;config:NonNullable<Level['lifts']>[number]}[]=[];
 private laserBeams:{art:Phaser.GameObjects.Rectangle;config:NonNullable<Level['lasers']>[number];active:boolean}[]=[];
 private inverted=false; private crate?:Phaser.Physics.Arcade.Sprite; private crateReady=false; private chaseWall?:Phaser.GameObjects.Rectangle; private chasing=false; private checkpointReached=false; private trailTimer=0; private musicStop?:()=>void;
 private sequenceHits=0; private sequenceStatus?:Phaser.GameObjects.Text; private bossVulnerable=false; private bossHits=0; private bossNextAttack=1.2; private bossArt?:Phaser.GameObjects.Container; private bossStatus?:Phaser.GameObjects.Text; private bossHealth?:Phaser.GameObjects.Rectangle; private bossStrikes:Phaser.GameObjects.Rectangle[]=[]; private bossPlates:Phaser.GameObjects.Rectangle[]=[];
 private movingSkulls: Phaser.GameObjects.Container[]=[];
 private player!: Phaser.Physics.Arcade.Sprite;
 private keys!: Record<string, Phaser.Input.Keyboard.Key>;
 private floors!: Phaser.Physics.Arcade.StaticGroup;
 private spikes: {body: Phaser.GameObjects.Rectangle; x:number; width:number; active:boolean; trigger:number; y:number; activateOn:Hazard['activateOn'];disarmed?:boolean;art?:Phaser.GameObjects.Graphics}[]=[];
 private checkpointTriggered=false; private jumpTrapTriggered=false; private exitMoved=false; private exitX=0; private exitArt!: Phaser.GameObjects.Container; private wallArt?: Phaser.GameObjects.Rectangle; private lastTick=0; private elapsed=0; private ended=false; private reversed=false; private jumpHeld=false; private lastGround=0; private jumpQueued=0; private opened=false; private gift=false;
 constructor(private level:Level,private controls:Controls,private emit:(e:GameEvent)=>void,private soundEnabled:boolean,private reducedMotion:boolean,private musicEnabled=false,private spawnX=85,private carryTime=0){super('play');}
 create(){
 const worldHeight=this.level.height??540;this.physics.world.setBounds(0,0,960,worldHeight);this.cameras.main.setZoom(.8*(this.scale.width/960));this.cameras.main.setBounds(-120,-68,1200,Math.max(675,worldHeight+136));this.cameras.main.centerOn(480,270);
 const g=this.add.graphics(); g.fillStyle(this.level.id>30?0x152b38:this.level.id>20?0x291d28:this.level.id>10?0x211d34:0x171c2d);g.fillRect(-120,-68,1200,worldHeight+136);
 for(let i=0;i<65;i++){g.fillStyle(i%3?0x39415a:0x76809b);g.fillRect((i*137)%960,(i*73)%340,2,2);}
 g.fillStyle(0x202638);for(let i=0;i<12;i++)g.fillRect(i*90,300-(i%3)*34,70,150+(i%3)*34);
 g.lineStyle(1,0x30364a);for(let x=0;x<960;x+=48)g.lineBetween(x,450,x,540);for(let y=450;y<540;y+=30)g.lineBetween(0,y,960,y);
 const biome=worldForLevel(this.level.id).id;g.fillStyle(biome===1?0x314236:biome===2?0x393154:biome===4?0x42616b:0x5b3434,.65);for(let i=0;i<16;i++){const x=(i*83)%960;g.fillRect(x,365,12,85);g.fillRect(x-9,372,30,8);if(biome===2||biome===4){g.fillTriangle(x-10,375,x+6,320,x+24,375);}if(biome===3){g.fillStyle(0xff916744,.2);g.fillRect(x,480,32,20);}}
 const art=this.make.graphics({x:0,y:0});
 art.fillStyle(0xbafa54);art.fillRect(6,0,20,7);art.fillRect(2,7,28,19);art.fillStyle(0x131c22);art.fillRect(8,11,5,6);art.fillRect(21,11,5,6);art.fillRect(12,21,9,3);art.fillStyle(0xf0f4dd);art.fillRect(7,27,18,12);art.fillStyle(0x899ba4);art.fillRect(4,39,9,7);art.fillRect(20,39,9,7);art.generateTexture('hero',32,46);art.destroy();
 this.floors=this.physics.add.staticGroup();
 for(const p of this.level.platforms){const block=this.add.rectangle(p.x+p.width/2,p.y+16,p.width,32,0x626d83);const trim=this.add.graphics({x:block.x,y:block.y});
 trim.fillStyle(0xb3c1d4);trim.fillRect(-p.width/2,-16,p.width,2);trim.fillRect(-p.width/2,14,p.width,2);
 Object.assign(block,{trim});this.floors.add(block);if(p.collapse){Object.assign(block,{collapse:true,collapseMs:p.collapseMs??120});}}
 this.elapsed=this.carryTime;this.player=this.physics.add.sprite(this.level.spawn?.x??this.spawnX,this.level.spawn?.y??420,'hero').setOrigin(.5,1).setSize(24,44).setOffset(4,2).setDepth(5);this.player.setMaxVelocity(280,Math.max(700,...(this.level.springs??[]).map(s=>s.power)));this.player.setDragX(2400);if(worldHeight>540)this.cameras.main.startFollow(this.player,true,1,1,0,50);
 const walk=this.add.graphics();for(let frame=0;frame<2;frame++){walk.clear();walk.fillStyle(0xbafa54);walk.fillRect(2,0,28,26);walk.fillStyle(0x17221b);walk.fillRect(8,8,5,7);walk.fillRect(21,8,5,7);walk.fillRect(12,20,9,3);walk.fillStyle(0xf0f4dd);walk.fillRect(7,27,18,12);walk.fillStyle(0x899ba4);walk.fillRect(frame?2:7,39,9,7);walk.fillRect(frame?21:16,39,9,7);walk.generateTexture('walk'+frame,32,46);}walk.destroy();
 this.anims.create({key:'walk',frames:[{key:'walk0'},{key:'walk1'}],frameRate:9,repeat:-1});
 if(this.musicEnabled)this.musicStop=startMusic(worldForLevel(this.level.id).id);
 this.events.on('pause',()=>{this.input.keyboard?.removeCapture(['LEFT','RIGHT','UP','SPACE']);this.musicStop?.();this.musicStop=undefined;});this.events.on('resume',()=>{this.input.keyboard?.addCapture(['LEFT','RIGHT','UP','SPACE']);if(this.musicEnabled&&!this.ended&&!this.musicStop)this.musicStop=startMusic(worldForLevel(this.level.id).id);});this.events.once('shutdown',()=>this.musicStop?.());
 this.physics.add.collider(this.player,this.floors,(_player,floor)=>{const b=floor as Phaser.GameObjects.Rectangle & {collapse?:boolean; falling?:boolean; collapseMs?:number; trim:Phaser.GameObjects.Graphics};if(b.collapse&&!b.falling){b.falling=true;b.setFillStyle(0xd98555);this.time.delayedCall(b.collapseMs??120,()=>{if(b.active){(b.body as Phaser.Physics.Arcade.StaticBody).enable=false;if(this.reducedMotion){b.setVisible(false);b.trim.setVisible(false);}else this.tweens.add({targets:[b,b.trim],y:600,alpha:0,duration:350});}});}},()=>!this.climbing);
 this.createMachinery();
 for(const h of this.level.hazards){
 const body=this.add.rectangle(h.x+h.width/2,(h.y??450)-12,h.width,24,0xe76878,0);
 this.physics.add.existing(body,true);(body.body as Phaser.Physics.Arcade.StaticBody).enable=!h.hidden;
 this.spikes.push({body,x:h.x,width:h.width,active:!h.hidden,trigger:h.triggerX??h.x-50,activateOn:h.activateOn,y:h.y??450});
 this.physics.add.overlap(this.player,body,()=>this.die());
 if(!h.hidden)this.drawSpikes(h.x,h.width,false,h.y??450);
 }
 for(const hazard of this.level.movingHazards??[]){
 const skull=this.add.container(hazard.x,300,[this.add.circle(0,0,17,0xe76878),this.add.rectangle(-6,-3,5,7,0x171c2d),this.add.rectangle(6,-3,5,7,0x171c2d),this.add.rectangle(0,8,11,3,0x171c2d)]);
 this.physics.add.existing(skull);const body=skull.body as Phaser.Physics.Arcade.Body;body.setAllowGravity(false);body.setImmovable(true);body.setCircle(16,-16,-16);
 this.physics.add.overlap(this.player,skull,()=>this.die());
 // Keep body and artwork together using physics velocity rather than moving a static body.
 skull.setData('hazard',hazard);this.movingSkulls.push(skull);
 }
 this.exitX=this.level.exit;this.exitArt=this.door(this.exitX,this.level.exitY??450);for(const x of this.level.fakeExits??[])this.door(x);
 if(this.level.fakeCheckpoint){const x=this.level.fakeCheckpoint;this.add.rectangle(x,422,3,56,0xb3c1d4);this.add.rectangle(x+14,402,26,17,0x7bd5ef);this.label(x-35,370,'CHECKPOINT',{fontFamily:'monospace',fontSize:'12px',color:'#7bd5ef'});}
 if(this.level.invisibleWall){const x=this.level.invisibleWall;this.wallArt=this.add.rectangle(x,422,24,56,0xa2b7d4,0);this.physics.add.existing(this.wallArt,true);this.physics.add.collider(this.player,this.wallArt,()=>{this.wallArt?.setAlpha(.35);});}
 if(this.level.noJumpZone){const [from,to]=this.level.noJumpZone;this.add.rectangle((from+to)/2,450,to-from,3,0xf7c85b);this.label(from,345,'DON’T JUMP',{fontFamily:'monospace',fontSize:'14px',color:'#f7c85b'});}
 if(this.level.checkpoint){const x=this.level.checkpoint;this.add.rectangle(x,422,3,56,0xb3c1d4);this.add.rectangle(x+14,402,26,17,0x7bd5ef);this.label(x-35,370,'CHECKPOINT',{fontFamily:'monospace',fontSize:'10px',color:'#7bd5ef'});}
 if(this.level.gravityZones){for(const zone of this.level.gravityZones){this.add.rectangle((zone.from+zone.to)/2,335,zone.to-zone.from,230,0x59b8ef,.09);this.label(zone.from,180,'↑ GRAVITY ZONE',{fontFamily:'monospace',fontSize:'12px',color:'#7bd5ef'});}}
 if(this.level.crate){const art=this.add.graphics();art.fillStyle(0x98723e);art.fillRect(0,0,40,40);art.lineStyle(3,0xe3b777);art.strokeRect(2,2,36,36);art.lineBetween(3,3,37,37);art.lineBetween(37,3,3,37);art.generateTexture('crate',40,40);art.destroy();this.crate=this.physics.add.sprite(this.level.crate.x,429,'crate').setPushable(true).setDragX(1600).setMaxVelocity(160,600);this.physics.add.collider(this.crate,this.floors);this.physics.add.collider(this.player,this.crate);this.add.rectangle(this.level.crate.target,447,54,6,0xe3b777);this.label(this.level.crate.target-25,375,'PUSH HERE',{fontFamily:'monospace',fontSize:'10px',color:'#e3b777'});}
 if(this.level.chase){this.chaseWall=this.add.rectangle(-35,405,50,90,0xff697c,.85);this.physics.add.existing(this.chaseWall);const body=this.chaseWall.body as Phaser.Physics.Arcade.Body;body.setAllowGravity(false);body.setImmovable(true);this.physics.add.overlap(this.player,this.chaseWall,()=>this.die());this.label(35,110,'THE WALL WILL CHASE YOU',{fontFamily:'monospace',fontSize:'13px',color:'#ff8fa4'});}
 if(this.level.switch){this.add.rectangle(this.level.switch,439,38,12,0xf7c85b);this.label(this.level.switch-28,390,'SWITCH',{fontFamily:'monospace',fontSize:'12px',color:'#f7c85b'});}
 if(this.level.coin){this.add.circle(this.level.coin,425,10,0xf8ce66).setStrokeStyle(3,0xa86d35);this.label(this.level.coin-45,375,'FREE GIFT!',{fontFamily:'monospace',fontSize:'13px',color:'#f8ce66'});}
 if(this.level.reverseAt){g.lineStyle(2,0xb49aff,.7);g.lineBetween(this.level.reverseAt,320,this.level.reverseAt,450);this.label(this.level.reverseAt-55,296,'CONTROL ZONE',{fontFamily:'monospace',fontSize:'13px',color:'#b49aff'});}
 this.label(35,45,worldForLevel(this.level.id).name.toUpperCase(),{fontFamily:'monospace',fontSize:'13px',color:'#758198'});this.label(35,70,this.level.subtitle,{fontFamily:'monospace',fontSize:'20px',color:'#dce2ef'});
 this.label(70,475,'YOU →',{fontFamily:'monospace',fontSize:'14px',color:'#bafa54'});
 if(this.level.switchSequence){for(const [index,x] of this.level.switchSequence.entries()){this.add.rectangle(x,439,36,12,0xf7c85b);this.label(x-16,395,String(index+1),{fontFamily:'monospace',fontSize:'14px',color:'#f7c85b'});}this.sequenceStatus=this.label(35,110,'NEXT SWITCH: '+this.level.switchSequence[0],{fontFamily:'monospace',fontSize:'13px',color:'#f7c85b'});}
 if(this.level.reverseZones){for(const [from,to] of this.level.reverseZones){for(const x of [from,to]){g.lineStyle(2,0xb49aff,.7);g.lineBetween(x,325,x,450);}this.label(from,300,'REVERSE ZONE',{fontFamily:'monospace',fontSize:'12px',color:'#b49aff'});}}
 if(this.level.boss)this.createBoss();
 if(this.level.timeLimit)this.label(35,140,`FINISH IN ${this.level.timeLimit}s${this.level.checkpoint?'':' · NO CHECKPOINTS'}`,{fontFamily:'monospace',fontSize:'12px',color:'#ffbc65'});
 this.keys=this.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE') as typeof this.keys;
 this.input.keyboard!.addCapture(['LEFT','RIGHT','UP','SPACE']);
 }

 private label(x:number,y:number,text:string,style:Phaser.Types.GameObjects.Text.TextStyle){
 const res=typeof window!=='undefined'&&(/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||window.innerWidth<800)?1.5:2;
 const label=this.add.text(x,y,text,{...style,fontFamily:'Arial, Helvetica, sans-serif'}).setResolution(res);
 label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);return label;
 }
 private createMachinery(){
 for(const l of this.level.ladders??[]){const g=this.add.graphics();g.lineStyle(4,0xffc86b);for(const x of [l.x-17,l.x+17])g.lineBetween(x,l.top-12,x,l.bottom);g.lineStyle(3,0xc79247);for(let y=l.top;y<l.bottom;y+=18)g.lineBetween(l.x-17,y,l.x+17,y);this.label(l.x-50,l.bottom-65,'↑ / W CLIMB',{fontFamily:'monospace',fontSize:'10px',color:'#ffc86b'});}
 for(const config of this.level.lifts??[]){const art=this.add.rectangle(config.x+config.width/2,config.y+9,config.width,18,0x5db9da).setStrokeStyle(2,0xc2f0ff);this.physics.add.existing(art);const body=art.body as Phaser.Physics.Arcade.Body;body.setAllowGravity(false).setImmovable(true);body.setFriction(1,0);this.physics.add.collider(this.player,art,undefined,()=>!this.climbing);this.lifts.push({art,config});const track=this.add.graphics();track.lineStyle(2,0x5db9da,.3);track.lineBetween(config.x+config.width/2,config.y,config.toX+config.width/2,config.toY);}
 for(const s of this.level.springs??[]){this.add.rectangle(s.x,s.y-6,54,12,0xffbc65).setStrokeStyle(2,0xffe1ac);this.label(s.x-16,s.y-32,'⇧',{fontFamily:'monospace',fontSize:'24px',color:'#ffbc65'});}
 for(const c of this.level.conveyors??[]){this.add.rectangle(c.x+c.width/2,c.y+4,c.width,8,0x4da98f);for(let x=c.x+15;x<c.x+c.width;x+=32)this.label(x,c.y-20,c.speed>0?'›':'‹',{fontFamily:'monospace',fontSize:'22px',color:'#78e6cd'});}
 for(const config of this.level.lasers??[]){const art=this.add.rectangle(config.x,config.y-config.height/2,12,config.height,0xff6b6b);this.add.rectangle(config.x,config.y+3,30,8,0xa4adbf);this.add.rectangle(config.x,config.y-config.height-3,30,8,0xa4adbf);this.physics.add.existing(art,true);this.physics.add.overlap(this.player,art,()=>this.die());this.laserBeams.push({art,config,active:true});}
 if(this.level.key){const {x,y}=this.level.key;this.keyArt=this.add.container(x,y-30,[this.add.circle(-6,0,8,0xffcf66),this.add.rectangle(8,0,20,5,0xffcf66),this.add.rectangle(15,5,4,9,0xffcf66)]);this.label(this.level.exit-40,(this.level.exitY??450)-115,'KEY NEEDED',{fontFamily:'monospace',fontSize:'11px',color:'#ffcf66'}).setName('key-label');}
 }
 private updateMachinery(delta:number){
 const b=this.player.body as Phaser.Physics.Arcade.Body;
 for(const {art,config:c} of this.lifts){const phase=((this.elapsed*1000/c.period+(c.phase??0))%1+1)%1;const t=1-Math.abs(2*phase-1);const body=art.body as Phaser.Physics.Arcade.Body;const dt=Math.max(delta/1000,.001);body.setVelocity((c.x+(c.toX-c.x)*t+c.width/2-art.x)/dt,(c.y+(c.toY-c.y)*t+9-art.y)/dt);}
 for(const beam of this.laserBeams){const c=beam.config;const phase=(this.elapsed*1000+(c.phase??0))%c.period;beam.active=phase<c.onMs;(beam.art.body as Phaser.Physics.Arcade.StaticBody).enable=beam.active;beam.art.setAlpha(beam.active?1:phase>c.period-350?.4:.08);}
 if(this.level.key&&!this.hasKey&&Math.abs(this.player.x-this.level.key.x)<30&&Math.abs(this.player.y-this.level.key.y)<55){this.hasKey=true;this.keyArt?.destroy();(this.children.getByName('key-label') as Phaser.GameObjects.Text)?.setText('UNLOCKED');this.beep(950);}
 if(b.blocked.down&&!this.climbing){for(const s of this.level.springs??[]){if(Math.abs(this.player.x-s.x)<30&&Math.abs(this.player.y-s.y)<8){this.player.setVelocityY(-s.power);this.lastGround=-1;this.beep(650);}}
}
 }
 private createBoss(){
 const boss=this.level.boss!;const bossColor=[0x84b94c,0x8866bd,0xc29a59,0xc46b92,0xbe7654,0xe76878,0x7bd5ef,0x66a9e8][(this.level.id/5-1)%8];
 this.bossHealth=this.add.rectangle(480,160,150,7,bossColor);
 this.bossArt=this.add.container(480,210,[this.add.rectangle(0,0,100,74,bossColor),this.add.rectangle(-27,-5,18,20,0x171c2d),this.add.rectangle(27,-5,18,20,0x171c2d),this.add.rectangle(0,20,34,8,0x171c2d),this.add.triangle(-40,-49,0,25,12,0,24,25,0xf7c85b),this.add.triangle(30,-49,0,25,12,0,24,25,0xf7c85b)]);
 if(boss.mechanic==='airborne'){this.bossArt.add([this.add.triangle(-85,0,0,35,50,0,50,60,bossColor),this.add.triangle(50,0,0,0,50,35,0,60,bossColor)]);}else if(boss.mechanic==='survival'){this.bossArt.add([this.add.rectangle(-70,20,45,20,0xa8b6c7),this.add.rectangle(70,20,45,20,0xa8b6c7)]);}else if(boss.mechanic==='pursuit'){this.bossArt.add(this.add.circle(0,-65,20,0xffcf66));}
 this.bossStatus=this.label(480,130,boss.name.toUpperCase()+' · '+(boss.mechanic==='survival'?`SURVIVE ${boss.survivalSeconds}s`:boss.mechanic==='airborne'?'JUMP TO HIT':boss.mechanic==='pursuit'?'CHASE THE LIGHT':'THREE FLOOR SEALS'),{fontFamily:'monospace',fontSize:'16px',color:'#ff9aba'}).setOrigin(.5);
 for(const [i,x] of boss.plates.entries()){if(boss.mechanic==='survival')break;this.bossPlates.push(this.add.rectangle(x,boss.mechanic==='airborne'?330:438,boss.mechanic==='airborne'?32:44,boss.mechanic==='airborne'?32:16,i===0?0xbafa54:0x5b526b).setStrokeStyle(2,0xe0e4f0));const label=this.label(x,boss.mechanic==='airborne'?295:405,String(i+1),{fontFamily:'monospace',fontSize:'13px',color:'#e0e4f0'}).setOrigin(.5);this.bossPlates[this.bossPlates.length-1].setData('number-label',label);}
 }
 private updateBoss(grounded:boolean){
 const boss=this.level.boss!;
 if(boss.mechanic==='pursuit')this.bossPlates.forEach((plate,i)=>{if(i>=this.bossHits){plate.x=boss.plates[i]+Math.sin(this.elapsed*1.8+i)*70;(plate.getData('number-label') as Phaser.GameObjects.Text).x=plate.x;}});
 const targets=this.bossPlates.length?this.bossPlates.map(p=>p.x):boss.plates;
 const ready=boss.mechanic==='airborne'?Math.abs(this.player.y-350)<30:grounded;
 const hits=boss.mechanic==='survival'?Math.min(3,Math.floor(this.elapsed/((boss.survivalSeconds??24)/3))):advanceSeal(targets,this.bossHits,this.player.x,ready&&this.bossVulnerable);
 if(hits>this.bossHits){if(boss.mechanic==='survival'){this.bossStrikes.forEach(strike=>strike.destroy());this.bossStrikes=[];}this.bossVulnerable=false;this.bossNextAttack=this.elapsed+.5;this.bossHits=hits;this.bossHealth?.setDisplaySize(150*(boss.plates.length-hits)/boss.plates.length,7);this.beep(800);this.bossPlates.forEach((plate,i)=>plate.setFillStyle(i<hits?0x334c31:i===hits?0xbafa54:0x5b526b));this.bossStatus?.setText(hits===boss.plates.length?'BOSS DEFEATED · EXIT OPEN':boss.name.toUpperCase()+' · DODGE NEXT');if(hits===boss.plates.length){this.bossArt?.setAlpha(.2);this.bossStrikes.forEach(s=>s.destroy());this.bossStrikes=[];}}
 if(this.bossHits===boss.plates.length||this.elapsed<this.bossNextAttack)return;
 const volleys=boss.volleys??1;const volleyDuration=boss.warningMs+330;
 this.bossNextAttack=this.elapsed+Math.max((volleys*volleyDuration+(volleys>=4?1100:volleys===3?1250:1600))/1000,boss.attackInterval/1000-this.bossHits*.2);
 this.bossVulnerable=false;
 const phaseHits=this.bossHits;
 const launch=(volley:number)=>{
 if(this.ended||this.bossHits===boss.plates.length||this.bossHits!==phaseHits)return;
 const positions=bossTargets(boss.pattern,this.player.x,(this.bossHits+volley)%3);
 this.bossStatus?.setText(boss.name.toUpperCase()+' · DODGE '+(volley+1)+' / '+volleys+' · LEAVE THE RED MARKERS');
 const strikes=positions.map(x=>{const strike=this.add.rectangle(x,437,boss.strikeWidth,26,0xff697c,.25).setDepth(4);this.physics.add.existing(strike,true);(strike.body as Phaser.Physics.Arcade.StaticBody).enable=false;this.physics.add.overlap(this.player,strike,()=>this.die());this.bossStrikes.push(strike);return strike;});
 this.time.delayedCall(boss.warningMs,()=>{if(this.ended||this.bossHits===boss.plates.length||this.bossHits!==phaseHits)return;for(const strike of strikes)if(strike.active){strike.setAlpha(1);(strike.body as Phaser.Physics.Arcade.StaticBody).enable=true;}this.beep(130);this.time.delayedCall(330,()=>{strikes.forEach(s=>s.destroy());this.bossStrikes=this.bossStrikes.filter(s=>s.active);if(this.ended||this.bossHits===boss.plates.length||this.bossHits!==phaseHits)return;if(volley+1<volleys)launch(volley+1);else{this.bossVulnerable=true;this.bossStatus?.setText(boss.name.toUpperCase()+' · '+(boss.mechanic==='airborne'?'JUMP INTO THE GLOWING ORB':boss.mechanic==='pursuit'?'CATCH THE MOVING LIGHT':boss.mechanic==='survival'?`SURVIVE ${Math.max(0,Math.ceil((boss.survivalSeconds??24)-this.elapsed))}s`:'HIT THE GLOWING SEAL'));}});});
 };
 launch(0);
 }
 private door(x:number,y=450){
 const frame=this.add.rectangle(0,411,48,78,0xbafa54).setStrokeStyle(5,0x3a5746);
 const inside=this.add.rectangle(0,417,30,60,0x213a32);
 const handle=this.add.rectangle(10,418,5,5,0xe7ffc2);
 const label=this.label(-21,356,'EXIT',{fontFamily:'monospace',fontSize:'14px',color:'#bafa54'});
 return this.add.container(x,y-450,[frame,inside,handle,label]);
 }
 private drawSpikes(x:number,width:number,rising=false,y=450){
 const g=this.add.graphics({x,y});g.fillStyle(0xed788c);
 for(let p=0;p<width;p+=18)g.fillTriangle(p,0,Math.min(p+9,width),-24,Math.min(p+18,width),0);
 if(rising&&!this.reducedMotion){g.setScale(1,0);this.tweens.add({targets:g,scaleY:1,duration:Math.max(16,Math.min(140,this.level.spikeDelay??90)),ease:'Cubic.easeOut'});}
 return g;
 }
 private beep(freq:number){if(this.soundEnabled)tone(freq);}
 private die(reason?:string){if(this.ended)return;this.ended=true;this.musicStop?.();this.musicStop=undefined;this.player.anims.stop();this.player.setTint(0xff7185);this.player.setVelocity(0,0);this.physics.pause();this.beep(100);if(!this.reducedMotion){this.cameras.main.shake(140,.006);for(let i=0;i<12;i++){const pixel=this.add.rectangle(this.player.x,this.player.y-22,5,5,i%2?0xbafa54:0xf0f4dd).setDepth(9);this.tweens.add({targets:pixel,x:pixel.x+(i%4-1.5)*30,y:pixel.y-25+(i/4)*20,alpha:0,duration:400,onComplete:()=>pixel.destroy()});}}this.emit({type:'death',time:this.elapsed,reason});}
 update(_now:number,delta:number){if(this.ended)return;this.elapsed+=Math.min(delta,60)/1000;if(this.level.timeLimit&&this.elapsed>=this.level.timeLimit){this.die(`Time ran out. Finish within ${this.level.timeLimit} seconds. Plan your route and commit to each opening.`);return;}
 for(const skull of this.movingSkulls){const h=skull.getData('hazard') as {period:number;phase:number};const angle=2*Math.PI*(this.elapsed*1000/h.period+h.phase);const targetY=345+78*Math.sin(angle);const body=skull.body as Phaser.Physics.Arcade.Body;body.setVelocityY((targetY-body.center.y)/Math.max(delta/1000,.001));}
 this.updateMachinery(delta);
 const b=this.player.body as Phaser.Physics.Arcade.Body;
 this.inverted=!!this.level.gravityZones?.some(z=>this.player.x>=z.from&&this.player.x<=z.to&&z.gravity<0);b.setGravityY(this.inverted?-2800:0);const grounded=!this.climbing&&(this.inverted?b.blocked.up:(b.blocked.down||b.touching.down));
 if(this.level.checkpoint&&!this.checkpointReached&&Math.abs(this.player.x-this.level.checkpoint)<25&&grounded){this.checkpointReached=true;this.emit({type:'checkpoint',x:this.level.checkpoint,time:this.elapsed});this.label(this.level.checkpoint-50,335,'CHECKPOINT SAVED',{fontFamily:'monospace',fontSize:'11px',color:'#7bd5ef'});this.beep(740);}
 if(this.crate&&this.level.crate&&!this.crateReady&&Math.abs(this.crate.x-this.level.crate.target)<28){this.crateReady=true;this.sequenceStatus?.setText('CRATE READY · NEXT SWITCH: '+this.level.switchSequence?.[0]);this.crate.setTint(0xbafa54);this.crate.setVelocity(0,0).setImmovable(true).setPushable(false);(this.crate.body as Phaser.Physics.Arcade.Body).moves=false;this.beep(660);}
 if(this.chaseWall&&this.level.chase){if(this.player.x>this.level.chase.startX)this.chasing=true;(this.chaseWall.body as Phaser.Physics.Arcade.Body).setVelocityX(this.chasing?this.level.chase.speed:0);}
 if(grounded&&Math.abs(b.velocity.x)>20)this.player.anims.play('walk',true);else{this.player.anims.stop();this.player.setTexture('hero');}this.player.setFlipY(this.inverted);
 if(!this.reducedMotion&&grounded&&Math.abs(b.velocity.x)>100&&this.elapsed-this.trailTimer>.1){this.trailTimer=this.elapsed;const dust=this.add.rectangle(this.player.x-12,this.player.y-2,4,3,0x9babbe,.5);this.tweens.add({targets:dust,x:dust.x-10,alpha:0,duration:220,onComplete:()=>dust.destroy()});}
 this.reversed=(!!this.level.reverseAt&&this.player.x>=this.level.reverseAt)||!!this.level.reverseZones?.some(([from,to])=>this.player.x>=from&&this.player.x<=to);
 const direction=Number(this.controls.right||this.keys.RIGHT.isDown||this.keys.D.isDown)-Number(this.controls.left||this.keys.LEFT.isDown||this.keys.A.isDown);
 this.player.setDragX(grounded?2400:2000);this.player.setAccelerationX(direction*(this.reversed?-1:1)*(grounded?2400:2100));if(direction)this.player.setFlipX(direction*(this.reversed?-1:1)<0);
 const conveyor=grounded?this.level.conveyors?.find(c=>this.player.x>c.x&&this.player.x<c.x+c.width&&Math.abs(this.player.y-c.y)<8):undefined;b.setMaxVelocity(280+Math.abs(conveyor?.speed??0),Math.max(700,...(this.level.springs??[]).map(s=>s.power)));if(conveyor)this.player.setAccelerationX(0).setVelocityX(direction*(this.reversed?-1:1)*280+conveyor.speed);
 const up=!!this.controls.up||this.keys.UP.isDown||this.keys.W.isDown,down=!!this.controls.down||this.keys.DOWN.isDown||this.keys.S.isDown;
 const ladder=this.level.ladders?.find(l=>Math.abs(this.player.x-l.x)<22&&this.player.y>=l.top-5&&this.player.y<=l.bottom+8);
 const jumping=this.controls.jump||this.keys.SPACE.isDown||(!ladder&&(up));
 if(ladder&&(up||down)&&!jumping&&(!this.level.boss||this.bossHits===3))this.climbing=true;
 if(this.climbing&&(!ladder||jumping||direction)) {this.climbing=false;b.setAllowGravity(true);if(jumping){this.player.setVelocityY(-525);this.lastGround=-1;this.jumpQueued=0;}}
 if(this.climbing&&ladder){b.setAllowGravity(false);this.player.setAccelerationX(0).setVelocityX(0).setVelocityY((Number(down)-Number(up))*170);if(up&&this.player.y<=ladder.top){this.climbing=false;b.setAllowGravity(true);this.player.setVelocityY(0);}if(down&&this.player.y>=ladder.bottom){this.climbing=false;b.setAllowGravity(true);}}
 if(grounded)this.lastGround=this.elapsed;if(jumping&&!this.jumpHeld)this.jumpQueued=this.elapsed+(this.level.jumpBuffer??.12);
 if(!this.climbing&&this.jumpQueued>this.elapsed&&this.elapsed-this.lastGround<(this.level.coyoteTime??.1)){if(this.level.noJumpZone&&this.player.x>=this.level.noJumpZone[0]&&this.player.x<=this.level.noJumpZone[1])this.jumpTrapTriggered=true;
 this.player.setVelocityY(this.inverted?525:-525);this.lastGround=-1;this.jumpQueued=0;this.beep(420);}this.jumpHeld=jumping;
 this.player.x=Phaser.Math.Clamp(this.player.x,16,944);
 if(this.level.fakeCheckpoint&&Math.abs(this.player.x-this.level.fakeCheckpoint)<25&&this.player.y>395)this.checkpointTriggered=true;
 for(const h of this.spikes){if(this.crate&&this.crate.x+20>h.x&&this.crate.x-20<h.x+h.width&&!h.disarmed){h.disarmed=true;(h.body.body as Phaser.Physics.Arcade.StaticBody).enable=false;h.art?.destroy();const cover=this.add.graphics();cover.fillStyle(0xd5b171);cover.fillRect(h.x,446,h.width,4);}const triggered=h.activateOn==='coin'?this.gift:h.activateOn==='checkpoint'?this.checkpointTriggered:h.activateOn==='jump'?this.jumpTrapTriggered:this.player.x>h.trigger;if(!h.active&&!h.disarmed&&triggered){h.active=true;h.art=this.drawSpikes(h.x,h.width,true,h.y);this.time.delayedCall(this.level.spikeDelay??90,()=>{if(!this.ended&&!h.disarmed)(h.body.body as Phaser.Physics.Arcade.StaticBody).enable=true;});}}
 if(this.level.coin&&Math.abs(this.player.x-this.level.coin)<25&&this.player.y>395)this.gift=true;
 for(const x of this.level.fakeExits??[])if(Math.abs(this.player.x-x)<32&&this.player.y>390)this.die();
 if(this.level.switch&&Math.abs(this.player.x-this.level.switch)<28&&b.blocked.down&&!this.opened){this.opened=true;this.label(755,320,'DOOR UNLOCKED ✓',{fontFamily:'monospace',fontSize:'14px',color:'#bafa54'});this.beep(660);}
 if(this.level.switchSequence&&(!this.level.crate||this.crateReady)){const next=advanceSeal(this.level.switchSequence,this.sequenceHits,this.player.x,b.blocked.down);if(next>this.sequenceHits){this.sequenceHits=next;this.beep(660);this.sequenceStatus?.setText(next===this.level.switchSequence.length?'ALL SWITCHES ACTIVE':'NEXT SWITCH: '+this.level.switchSequence[next]);}}
 if(this.level.boss){this.updateBoss(b.blocked.down);if(this.bossArt&&!this.reducedMotion)this.bossArt.y=210+Math.sin(this.elapsed*2)*5;}
 if(this.player.y>(this.level.height??540)+40||this.player.y<0)this.die();
 if(this.level.movingExit&&!this.exitMoved&&this.player.x>=this.level.movingExit.triggerX){this.exitMoved=true;this.exitX=this.level.movingExit.targetX;if(this.reducedMotion)this.exitArt.x=this.exitX;else this.tweens.add({targets:this.exitArt,x:this.exitX,duration:450,ease:'Cubic.easeOut'});this.label(580,310,'COME CLOSER. JUST KIDDING.',{fontFamily:'monospace',fontSize:'12px',color:'#bafa54'});}
 if(!this.ended&&Math.abs(this.player.x-this.exitX)<30&&Math.abs(this.player.y-(this.level.exitY??450))<60&&(!this.level.key||this.hasKey)&&(!this.level.switch||this.opened)&&(!this.level.switchSequence||this.sequenceHits===this.level.switchSequence.length)&&(!this.level.boss||this.bossHits===this.level.boss.plates.length)){this.ended=true;this.physics.pause();this.beep(880);this.emit({type:'complete',time:this.elapsed});}
 if(!this.ended&&this.elapsed-this.lastTick>=.1){this.lastTick=this.elapsed;this.emit({type:'tick',time:this.elapsed,reversed:this.reversed});}
 }
}
