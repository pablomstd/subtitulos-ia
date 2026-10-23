import http from 'node:http';
import app from './core.js';
export async function handler(req,res){
 try {const scheme=req.headers['x-forwarded-proto']||'http';const orig=req.headers['x-vercel-original-url']||req.url;const path=orig.startsWith('/api/index')?((orig.slice('/api/index'.length)||'/')):orig;const request=new Request(`${scheme}://${req.headers.host}${path}`,{method:req.method});const response=await app.fetch(request,process.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Error interno');}
}
export default handler;
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href)http.createServer(handler).listen(Number(process.env.PORT||7111),'0.0.0.0',()=>console.log('Subtítulos IA listo en puerto '+(process.env.PORT||7111)));
