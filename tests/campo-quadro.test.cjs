const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const CampoQuadro=require('../designacoes/campo-quadro.js'),Regras=require('../designacoes/regras.js');

test('campo de grupo usa o nome e o superintendente no sábado e domingo',()=>{
  const cfg={campo:{grupos:[{id:'g',nome:'Esperança',superintendenteId:'p'}]}};
  for(const data of ['2026-12-05','2026-12-06']){
    const item=Regras.aplicarGrupoCampo({data,localId:'l',dirigente:'outro'},'g',cfg,[{id:'p',ativo:true}]);
    assert.equal(item.grupoNome,'Esperança');assert.equal(item.dirigente,'p');assert.equal(item.localId,'l');
    assert.equal(Regras.aplicarGrupoCampo(item,null,cfg,[]).grupoId,null);
  }
  assert.throws(()=>Regras.aplicarGrupoCampo({data:'2026-12-07'},'g',cfg,[{id:'p'}]),/sábado ou domingo/);
  assert.throws(()=>Regras.aplicarGrupoCampo({data:'2026-12-05'},'g',cfg,[{id:'p',ativo:false}]),/ativo/);
  assert.throws(()=>Regras.aplicarGrupoCampo({data:'2026-12-05'},'removido',cfg,[]),/grupo cadastrado/);
});

test('saídas antigas continuam normais e saídas de grupo mantêm nome e dirigente salvos',()=>{
  const cfg={campo:{saidas:[{id:'s',dia:6,hora:'09:00',localId:'l'}]}};
  const salvas=[{data:'2026-12-05',saidaId:'s',grupoId:'g',grupoNome:'Esperança',dirigente:'p'}];
  const saidas=Regras.campoDoMes(2026,12,cfg,salvas);
  assert.equal(saidas[0].grupoNome,'Esperança');assert.equal(saidas[0].dirigente,'p');
  assert.equal(saidas[1].grupoId,undefined);assert.equal(saidas[1].dirigente,null);
});

test('Kanban renderiza dias em colunas com data, grupo e superintendente, respeitando só leitura',()=>{
  class Node{
    constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
    append(...nodes){this.children.push(...nodes);}appendChild(node){this.append(node);}
    replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
  }
  const c={document:{createElement:tag=>new Node(tag)},window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('designacoes/campo-quadro.js','utf8'),c);
  const parent=new Node('div');c.window.CampoQuadro.render(parent,{lista:[{id:'s',data:'2026-12-05',hora:'09:00',localId:'l',grupoId:'g',grupoNome:'Esperança',dirigente:'p'}],ocultos:[1,2,3,4,5],pode:false,hoje:'2026-12-01',nome:()=> 'Bruno',local:()=> 'Salão',conflitos:()=>[]});
  const board=parent.children.find(n=>n.className==='campo-board');assert.equal(board.children.length,2);
  const flat=n=>[n,...n.children.flatMap(flat)],nodes=flat(board);
  assert(nodes.some(n=>n.textContent==='Campo de grupo · Esperança'));assert(nodes.some(n=>n.textContent==='Bruno'));assert(nodes.some(n=>n.textContent==='05'));
  assert.equal(nodes.some(n=>n.tag==='button'),false);
});
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
