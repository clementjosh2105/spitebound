import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createApi } from './api.mjs';
const api=createApi(),dist=resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.ico':'image/vnd.microsoft.icon'};
const server=createServer(async(req,res)=>{if(req.url?.startsWith('/api/'))return void api.handle(req,res);if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);let file=resolve(dist,'.'+pathname);if(!file.startsWith(dist+sep)&&file!==dist){res.writeHead(403);return res.end();}if(file===dist||!extname(file))file=resolve(dist,'index.html');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end('Not found');}});
server.listen(Number(process.env.PORT)||8080,process.env.HOST||'0.0.0.0',()=>console.log(`Spitebound game and account server listening on port ${Number(process.env.PORT)||8080}`));
function stop(){server.close(()=>{api.close();process.exit(0);});}process.on('SIGTERM',stop);process.on('SIGINT',stop);
