const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const CampoQuadro=require('../designacoes/campo-quadro.js'),Regras=require('../designacoes/regras.js');
test('colunas de segunda a domingo preservam datas e horários, ocultar não altera registros',()=>{
  const lista=[{id:'a',data:'2026-12-05',hora:'15:00'},{id:'b',data:'2026-12-05',hora:'09:00'},{id:'c',data:'2026-12-06',hora:'09:00'}];
  assert.deepEqual(CampoQuadro.agrupar(lista).map(c=>c.dia),[1,2,3,4,5,6,0]);
  assert.deepEqual(CampoQuadro.agrupar(lista).find(c=>c.dia===6).itens.map(c=>c.id),['b','a']);
  assert.equal(CampoQuadro.agrupar(lista,[6]).some(c=>c.dia===6),false);assert.equal(lista.length,3);
  assert.equal(CampoQuadro.agrupar(lista,[0,1,2,3,4,5,6]).length,0);
  assert.deepEqual(CampoQuadro.ocultosValidos([0,0,7,-1,'6',null,6]),[0,6]);
});
function contexto(){
  const c={Regras,CampoQuadro,document:{getElementById:()=>null},window:{addEventListener(){}},DesignaUI:{toast(){}},console};
  vm.createContext(c);vm.runInContext(fs.readFileSync('designacoes/app.js','utf8'),c);
  const records=[{id:'app',diaMeio:3,outro:'preservado',campo:{locais:[{id:'l',nome:'Salão'}],saidas:[]}},{id:'campo_quadro',diasOcultos:[0]}];
  c.lista=async()=>records;c.salvar=async(col,id,data)=>{vm.runInContext('exigirEdicao()',c);const i=records.findIndex(r=>r.id===id);if(i>=0)records[i]={...data,id};else records.push({...data,id});};
  vm.runInContext('pode=true',c);return {c,records};
}
test('ocultar e reativar usa registro separado sem alterar configuração de horários',async()=>{
  const {c,records}=contexto();await c.salvarDiaCampoQuadro(6,true);assert.deepEqual([...records[1].diasOcultos],[0,6]);
  await c.salvarDiaCampoQuadro(6,false);assert.deepEqual([...records[1].diasOcultos],[0]);assert.equal(records[0].diaMeio,3);
});
test('adicionar saída preserva configuração atual e não duplica horários',async()=>{
  const {c,records}=contexto();await c.adicionarSaidaCampoQuadro({dia:6,hora:'09:00',localId:'l'});
  assert.equal(records[0].campo.saidas.length,1);assert.equal(records[0].outro,'preservado');
  await assert.rejects(c.adicionarSaidaCampoQuadro({dia:6,hora:'09:00',localId:'l'}),/Já existe/);
  await c.adicionarSaidaCampoQuadro({dia:6,hora:'15:00',novoLocal:'Casa Silva'});assert.equal(records[0].campo.locais.length,2);
  await assert.rejects(c.adicionarSaidaCampoQuadro({dia:7,hora:'09:00',localId:'l'}),/válidos/);
});
test('somente leitura bloqueia adicionar e ocultar; falha não muda estado local',async()=>{
  const {c}=contexto();vm.runInContext('pode=false',c);
  await assert.rejects(c.salvarDiaCampoQuadro(6,true),/Somente leitura/);
  await assert.rejects(c.adicionarSaidaCampoQuadro({dia:6,hora:'09:00',localId:'l'}),/Somente leitura/);
  vm.runInContext('pode=true',c);c.salvar=async()=>{throw new Error('offline');};
  await assert.rejects(c.salvarDiaCampoQuadro(6,true),/offline/);
  assert.equal(vm.runInContext('campoQuadroPrefs.diasOcultos',c),undefined);
});
