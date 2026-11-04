let context:AudioContext|null=null;
export function unlockAudio(){try{context??=new AudioContext();void context.resume();}catch{}}
export function tone(frequency:number,duration=.12,volume=.035,type:OscillatorType='square'){
 if(!context||context.state!=='running')return;const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+duration+.01);
}
export function startMusic(world:number):()=>void{const tunes=[[196,246.94,293.66,246.94,220,261.63,329.63,261.63],[164.81,196,246.94,196,146.83,174.61,220,174.61],[146.83,174.61,207.65,174.61,130.81,164.81,196,164.81],[174.61,220,293.66,220,164.81,246.94,329.63,246.94]];let step=0;const timer=window.setInterval(()=>{tone(tunes[(world-1)%tunes.length][step++%8],.23,.012,'triangle');},world===3?230:300);return()=>clearInterval(timer);}
