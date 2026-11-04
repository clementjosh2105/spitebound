import { loadEnv } from 'vite';
import { spawnSync } from 'node:child_process';

const settings=loadEnv('production',process.cwd(),'VITE_');
const url=settings.VITE_SUPABASE_URL;
const key=settings.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key){
 console.error('Cloudflare builds need VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Configure the public values from your Supabase project before building.');
 process.exit(1);
}
try{if(new URL(url).protocol!=='https:')throw new Error();}catch{
 console.error('VITE_SUPABASE_URL must be a valid HTTPS project URL.');process.exit(1);
}
let publicKey=key.startsWith('sb_publishable_');
if(!publicKey){try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}}
if(!publicKey){console.error('Use a Supabase publishable key or legacy anon key. Secret/service-role keys must never be included in the game.');process.exit(1);}
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{stdio:'inherit',env:{...process.env,...settings}});
process.exit(result.status??1);
