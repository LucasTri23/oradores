const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Regras=require('../designacoes/regras.js');
function montar(gravar=async()=>({error:null})){
  const elementos={},el=id=>elementos[id]??={value:'',checked:false,innerHTML:'Salvar configurações',textContent:'',disabled:false};
  const campos=[{type:'checkbox',value:'on',checked:true,dataset:{}},...['meio','fim'].flatMap(t=>['zoom','microfones','indicadores'].map(f=>({type:'number',dataset:{t,f},value:f==='zoom'?'0':f==='microfones'?'1':'2'})))];
  el('tabelaQtd').querySelectorAll=selector=>campos.filter(i=>(!selector.includes('type="number"')||i.type==='number')&&(!selector.includes('[data-t]')||i.dataset.t)&&(!selector.includes('[data-f]')||i.dataset.f));
  el('cfgDiaMeio').value='3';el('cfgDiaFim').value='6';
  const c={Regras,document:{getElementById:el},window:{addEventListener(){}},DesignaUI:{toast(){}},
    banco:{from:()=>({upsert:gravar})},renderizados:0};
  vm.createContext(c);vm.runInContext(fs.readFileSync('designacoes/app.js','utf8'),c);
  vm.runInContext("sb=banco;vinc={workspaceId:'equipe'};user={id:'usuario'};pode=true;cfg={diaMeio:4};renderConfig=()=>{renderizados++;};",c);
  return {c,el};
}
test('salva um microfone e zero Zoom sem tratar o checkbox Usar como quantidade',async()=>{
  let registro;const {c,el}=montar(async r=>{registro=r;return {error:null};});await c.salvarConfig();
  assert.equal(registro.collection,'desig_config');assert.equal(registro.id,'app');
  for(const tipo of ['meio','fim']){assert.equal(registro.data.quantidades[tipo].microfones,1);assert.equal(registro.data.quantidades[tipo].zoom,0);}
  assert.equal(registro.data.diaMeio,3);assert.equal(c.renderizados,1);assert.match(el('salvarConfigStatus').textContent,/Configurações salvas/);
  const quantidades=vm.runInContext('R.quantidades(cfg)',c);assert.equal(quantidades.fim.zoom,0);assert.equal(quantidades.meio.microfones,1);
});
test('falha do banco não altera as configurações locais e libera nova tentativa',async()=>{
  const {c,el}=montar(async()=>({error:new Error('Falha na conexão')}));await c.salvarConfig();
  assert.match(el('salvarConfigStatus').textContent,/Não foi possível salvar/);assert.equal(vm.runInContext('cfg.diaMeio',c),4);assert.equal(el('salvarConfigBtn').disabled,false);assert.equal(c.renderizados,0);
});
test('clique duplicado enquanto salva gera somente uma gravação',async()=>{
  let liberar,chamadas=0;const {c,el}=montar(()=>{chamadas++;return new Promise(r=>{liberar=r;});});
  const primeira=c.salvarConfig();await c.salvarConfig();assert.equal(chamadas,1);assert.equal(el('salvarConfigBtn').disabled,true);
  liberar({error:null});await primeira;assert.equal(el('salvarConfigBtn').disabled,false);
});
