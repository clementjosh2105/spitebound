import { defineConfig } from 'vite';
import { createApi } from './server/api.mjs';
function installApi(server) {
 const api=createApi();
 server.middlewares.use((req,res,next)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url||'/', 'http://local').pathname);}catch{res.statusCode=400;return res.end('Invalid path');}
 if(pathname.split('/').some(part=>['.data','server','supabase','.git'].includes(part)||part.startsWith('.env'))){res.statusCode=403;return res.end('Private server resource');}
 if(req.url?.startsWith('/api/'))void api.handle(req,res);else next();
 });
 server.httpServer?.once('close',()=>api.close());
}
export default defineConfig({
  base: './',
 plugins:[{name:'troll-account-api',configureServer:installApi,configurePreviewServer:installApi}],
 server:{fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.data/**','**/server/**','**/supabase/**']}},
});
