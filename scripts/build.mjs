import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export async function buildRenderer({production=true}={}){
 const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'dist');
 await mkdir(out,{recursive:true});
 await build({absWorkingDir:root,entryPoints:['src/pet.js','src/home.js'],bundle:true,outdir:out,format:'esm',target:'chrome140',minify:production,sourcemap:false,tsconfigRaw:{}});
 for(const name of ['pet.html','home.html','styles.css','home.css'])await copyFile(resolve(root,'src',name),resolve(out,name));
 await build({absWorkingDir:root,entryPoints:['src/model.js','src/animator.js','src/region.js'],bundle:true,outdir:resolve(root,'qa/lib'),format:'cjs',platform:'node',target:'node22',outExtension:{'.js':'.cjs'},tsconfigRaw:{}});
 console.log('Fin desktop renderer built.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildRenderer();
