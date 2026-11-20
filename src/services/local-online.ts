export type PlayerUser={id:string;email?:string;user_metadata:{username?:string}};
type Session={user:PlayerUser};
type Listener=(event:string,session:Session|null)=>void;
async function request(path:string,data?:unknown){let response:Response;try{response=await fetch('/api'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?undefined:{'Content-Type':'application/json'},credentials:'same-origin',body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)});}catch{throw new Error('Online account server is unreachable. Click "Continue as guest" below to play.');}if(response.status===404||!response.headers.get('content-type')?.includes('application/json')){throw new Error('Online accounts are not hosted on this static page. Please click "Continue as guest" below to play and save locally.');}let result:any;try{result=await response.json();}catch{throw new Error('Online accounts are not hosted on this static page. Please click "Continue as guest" below to play and save locally.');}if(!response.ok)throw new Error(result.error||'Unable to connect to the account server.');return result;}
export function createLocalClient(){
 const listeners=new Set<Listener>();
 const broadcast=(event:string,session:Session|null)=>listeners.forEach(fn=>fn(event,session));
 const changed=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('troll-account-session');
 if(changed)changed.onmessage=()=>{void request('/auth/session').then(data=>broadcast(data.session?'SIGNED_IN':'SIGNED_OUT',data.session)).catch(()=>{});};
 async function login(path:string,data:unknown){try{const result=await request(path,data);broadcast('SIGNED_IN',result.session);changed?.postMessage('refresh');return {data:result,error:null};}catch(error){return {data:{session:null},error:error as Error};}}
 return {
 auth:{
 async getSession(){try{return {data:await request('/auth/session')};}catch{return {data:{session:null}};}},
 onAuthStateChange(fn:Listener){listeners.add(fn);return {data:{subscription:{unsubscribe:()=>{listeners.delete(fn);}}}};},
 signInWithPassword:({email,password}:{email:string;password:string})=>login('/auth/login',{email,password}),
 signUp:({email,password,options}:{email:string;password:string;options:{data:{username:string};emailRedirectTo?:string}})=>login('/auth/signup',{email,password,username:options.data.username}),
 async signOut(){try{await request('/auth/logout',{});broadcast('SIGNED_OUT',null);changed?.postMessage('refresh');return {error:null};}catch(error){return {error:error as Error};}},
 async resetPasswordForEmail(email:string,_options?:unknown){try{await request('/auth/reset',{email});return {error:null};}catch(error){return {error:error as Error};}},
 async updateUser({password}:{password:string}){try{await request('/auth/update-password',{password});return {error:null};}catch(error){return {error:error as Error};}},
 },
 async rpc(name:string,args:Record<string,unknown>){try{if(name==='load_progress'){const value=await request('/progress');return {data:value.progress,error:null};}if(name==='save_progress'){const value=await request('/progress',{progress:args.p_progress});return {data:value.progress,error:null};}if(name==='begin_run'){const value=await request('/runs/start',{level:args.p_level,difficulty:args.p_difficulty});return {data:value.id,error:null};}if(name==='finish_run'){await request('/runs/finish',{run:args.p_run,time_ms:args.p_time_ms,deaths:args.p_deaths});return {data:null,error:null};}if(name==='campaign_leaderboard'){const value=await request(`/leaderboard?difficulty=${encodeURIComponent(String(args.p_difficulty))}`);return {data:value.rows,error:null};}if(name==='level_leaderboard'){const value=await request(`/leaderboard?level=${encodeURIComponent(String(args.p_level))}&difficulty=${encodeURIComponent(String(args.p_difficulty))}`);return {data:value.rows,error:null};}throw new Error('Unknown account request.');}catch(error){return {data:null,error:error as Error};}},
 };
}
