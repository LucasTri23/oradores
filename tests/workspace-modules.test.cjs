const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(role='owner',configured=true){
  const calls=[],dialogs=[];
  function el(){return {children:[],append(...xs){this.children.push(...xs);},appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},focus(){},remove(){},close(){},showModal(){dialogs.push(this);}};}
  const ctx={window:{},localStorage:{setItem(){}},document:{createElement:el,body:el()}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/shared/conta.js','utf8'),ctx);
  const c=ctx.window.Conta;
  c.usarCliente({from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='workspace_members'?{workspace_id:'w',role,modules:['oradores','designacoes'],readonly:['designacoes']}:{name:'Central',enabled_modules:['designacoes'],modules_configured_at:configured?'date':null}};}};},async rpc(name,args){calls.push({name,args});return {error:null};}});
  return {c,calls,dialogs};
}

test('módulos ativos limitam proprietário e preservam permissões individuais',async()=>{
  for(const role of ['owner','editor']){
    const {c}=setup(role),v=await c.vinculo({id:'u'});
    assert.equal(c.podeVer(v,'oradores'),false);
    assert.equal(c.podeVer(v,'designacoes'),true);
    assert.equal(c.podeEditar(v,'designacoes'),role==='owner');
  }
});
test('somente proprietário salva seleção não vazia',async()=>{
  const {c,calls}=setup();const v=await c.vinculo({id:'u'});
  await assert.rejects(c.salvarModulos({...v,role:'editor'},['oradores']));
  await assert.rejects(c.salvarModulos(v,[]));
  await assert.rejects(c.salvarModulos(v,['invalido']));assert.equal(calls.length,0);
  await c.salvarModulos(v,['oradores']);assert.equal(calls[0].name,'set_workspace_modules');
  assert.equal(c.podeVer(v,'oradores'),true);assert.equal(c.podeVer(v,'designacoes'),false);
});
test('primeiro acesso do proprietário aguarda escolha; membro não recebe diálogo',async()=>{
  const {c,dialogs,calls}=setup('owner',false);let ready=false;
  const pending=c.vinculo({id:'u'}).then(v=>{ready=true;return v;});
  await new Promise(r=>setImmediate(r));assert.equal(ready,false);assert.equal(dialogs.length,1);
  const save=dialogs[0].children.find(e=>e.textContent==='Salvar módulos da congregação');await save.onclick();
  const v=await pending;assert.equal(v.modulosConfigurados,true);assert.equal(calls.length,1);
  const member=setup('editor',false);await member.c.vinculo({id:'u'});assert.equal(member.dialogs.length,0);
});
test('ícone é quadrado e manifesto corresponde ao arquivo real',()=>{
  const m=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8')),b=fs.readFileSync('.'+m.icons[0].src);
  const w=b.readUInt32BE(16),h=b.readUInt32BE(20);assert.equal(w,h);assert.equal(m.icons[0].sizes,`${w}x${h}`);
});
