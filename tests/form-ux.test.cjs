const {test}=require('node:test');
const assert=require('node:assert/strict');
const UX=require('../assets/shared/form-ux.js');
const Store=require('../assets/shared/config-store.js');
function fixture(){const listeners={};return {form:{addEventListener:(k,f)=>listeners[k]=f,setAttribute(){},removeAttribute(){}},button:{innerHTML:'Salvar'},status:{dataset:{}},listeners};}
test('feedback acompanha alterações, impede envio duplicado e preserva novas edições',async()=>{
  const {form,button,status,listeners}=fixture();UX.rastrear(form,button,status);listeners.input();assert.equal(status.dataset.estado,'pendente');
  let resolve,calls=0;const action=()=>{calls++;return new Promise(r=>resolve=r);};
  const first=UX.executar(form,button,status,action);assert.equal(button.disabled,true);
  assert.equal(await UX.executar(form,button,status,action),false);assert.equal(calls,1);
  listeners.change();resolve(true);await first;assert.equal(status.dataset.estado,'pendente');assert.equal(button.disabled,false);
  await UX.executar(form,button,status,()=>true);assert.equal(status.dataset.estado,'salvo');
});
test('falha mantém formulário disponível e apresenta erro junto ao botão',async()=>{
  const {form,button,status}=fixture();assert.equal(await UX.executar(form,button,status,()=>{throw new Error('Verifique a conexão.');}),false);
  assert.equal(status.dataset.estado,'erro');assert.match(status.textContent,/conexão/);assert.equal(button.disabled,false);
});
function banco(error=null){const writes=[];const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{data:{quantidades:{meio:{microfones:2}},outraPreferencia:true}},error:null};},async upsert(value){writes.push(value);return {error};}};return {sb:{from:()=>query},writes};}
const conta={podeVer:()=>true,podeEditar:()=>true};
test('preferências preservam campos existentes e gravam zero Zoom e um microfone',async()=>{
  const {sb,writes}=banco();const store=Store.criar(sb,{workspaceId:'w'},{id:'u'},conta);
  await store.salvar('desig_config','app',{quantidades:{meio:{microfones:1,zoom:0}},zoomSemanal:false});
  assert.equal(writes[0].data.outraPreferencia,true);assert.equal(writes[0].data.quantidades.meio.zoom,0);assert.equal(writes[0].data.quantidades.meio.microfones,1);assert.equal(writes[0].workspace_id,'w');
});
test('preferências bloqueiam escrita sem permissão e propagam falha do banco',async()=>{
  const {sb,writes}=banco({message:'technical'});
  await assert.rejects(Store.criar(sb,{workspaceId:'w'},{id:'u'},{...conta,podeEditar:()=>false}).salvar('config','app',{}),/não pode editar/);assert.equal(writes.length,0);
  await assert.rejects(Store.criar(sb,{workspaceId:'w'},{id:'u'},conta).salvar('config','app',{}),/não foi concluída/);
});
