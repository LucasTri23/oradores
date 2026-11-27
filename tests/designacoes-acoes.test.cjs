const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Regras=require('../designacoes/regras.js');
function contexto(){
  const nodes={};const c={Regras:{...Regras},document:{getElementById:id=>nodes[id]||(nodes[id]={value:'',checked:false})},window:{addEventListener(){}},DesignaUI:{toast(){}},confirm:()=>true};
  vm.createContext(c);vm.runInContext(fs.readFileSync('designacoes/app.js','utf8'),c);
  vm.runInContext('pode=true;var semanasVmc=[];var mesVmc=new Date(2026,10,1);mesCampo=new Date(2026,11,1);',c);
  c.abrirJanela=()=>{};c.fecharJanela=()=>{};c.irAba=()=>{};c.renderCampo=()=>{};return {c,nodes};
}
test('apagar Campo usa seu mes e seleciona Campo; registros antigos conservam o ID',async()=>{
  const {c,nodes}=contexto();await c.abrirApagar('campo');
  assert.equal(nodes.apCampo.checked,true);assert.equal(nodes.apProg.checked,false);assert.equal(nodes.apPeriodo.value,'mes');
  vm.runInContext("campo=[{id:'saida',data:'2026-12-05',dirigente:'p'}];reunioes=[{id:'legado',data:'2026-12-02',pessoas:{presidente:['p']}}]",c);
  nodes.apProg.checked=true;nodes.apConfirma.value='APAGAR';
  const saves=[];c.salvarVarios=async(col,itens)=>saves.push({col,itens});await c.apagarDesignacoes();
  assert.equal(saves[0].itens[0].id,'legado');assert.equal(saves[1].itens[0].dados.dirigente,null);
  assert.equal(vm.runInContext('Object.keys(reunioes[0].pessoas).length',c),0);
});
test('sugestao de Campo preserva ocupados e cancelados e usa somente habilitados',async()=>{
  const {c}=contexto();vm.runInContext("pessoas=[{id:'p',ativo:true,funcoes:{[CAMPO]:true}},{id:'nao',ativo:true,funcoes:{}}];campo=[{id:'ocupado',data:'2099-12-05',dirigente:'outro'}]",c);
  c.Regras.campoDoMes=()=>[{id:'vaga',data:'2099-12-06',hora:'09:00'},{id:'ocupado',data:'2099-12-05',dirigente:'outro'},{id:'cancelado',data:'2099-12-07',semSaida:true}];
  const saves=[];c.salvar=async(col,id,data)=>saves.push({id,data});await c.sugerirCampoMes();
  assert.equal(saves.length,1);assert.equal(saves[0].id,'vaga');assert.equal(saves[0].data.dirigente,'p');
  vm.runInContext('pode=false',c);await c.sugerirCampoMes();assert.equal(saves.length,1);
});
