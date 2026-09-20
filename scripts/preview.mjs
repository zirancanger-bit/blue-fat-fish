import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),captures=fileURLToPath(new URL('../qa/previews/',import.meta.url));await mkdir(captures,{recursive:true});
http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(req.method==='POST'&&/^\/_capture\/[a-z-]+\.png$/.test(pathname)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>12e6)throw Error('Too large');chunks.push(chunk);}const file=path.basename(pathname);await writeFile(path.join(captures,file),Buffer.concat(chunks));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({fileName:file}));return;}
 const filename=path.resolve(root,'.'+(pathname==='/'?'/home.html':pathname));if(!filename.startsWith(root))throw Error('Invalid path');const data=await readFile(filename);res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':filename.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(0,'127.0.0.1',function(){console.log('FIN_PREVIEW http://127.0.0.1:'+this.address().port+'/home.html?qa=1');});
