// Monta os arquivos de produção sem alterar a configuração atual de deploy.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw new Error('Destino inválido para o build.');
if(fs.existsSync(out)){
  if(fs.lstatSync(out).isSymbolicLink()||fs.realpathSync(out)!==out)throw new Error('O diretório de build precisa permanecer dentro do projeto.');
  fs.rmSync(out,{recursive:true,force:true});
}
fs.mkdirSync(out);
const folders=['assets','api','designacoes','oradores','territorios','quadro','publicacoes','vendor'];
let files=0;
function copy(source,destination){
  if(fs.lstatSync(source).isSymbolicLink())throw new Error('Links simbólicos não são incluídos no build.');
  if(fs.statSync(source).isDirectory()){fs.mkdirSync(destination,{recursive:true});for(const item of fs.readdirSync(source))copy(path.join(source,item),path.join(destination,item));}
  else{if(source.endsWith('.sql'))return;fs.copyFileSync(source,destination);files++;}
}
for(const folder of folders)copy(path.join(root,folder),path.join(out,folder));
for(const name of ['index.html','manifest.webmanifest','sw.js','vercel.json'])copy(path.join(root,name),path.join(out,name));
function validate(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);if(fs.statSync(file).isDirectory()){validate(file);continue;}if(!file.endsWith('.html'))continue;
  const html=fs.readFileSync(file,'utf8');
  for(const m of html.matchAll(/(?:src|href)="(\/[^"?]+\.(?:js|mjs|css|png|svg|webmanifest))(?:\?[^" ]*)?"/g))if(!fs.existsSync(path.join(out,m[1])))throw new Error('Recurso ausente no build: '+m[1]);
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=|\btype=/.test(m[1]))new vm.Script(m[2],{filename:file});
}}
validate(out);console.log('Build estático concluído: '+files+' arquivos em '+out+'. Recursos locais e scripts inline conferidos.');
