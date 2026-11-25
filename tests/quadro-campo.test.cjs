const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../designacoes/regras.js'),Campo=require('../quadro/campo.js');
global.PdfPaleta=require('../assets/shared/pdf-paleta.js');
const {jsPDF}=require('../assets/js/vendor/jspdf.umd.min.js');
const cfg={campo:{locais:[{id:'l',nome:'Salão do Reino'},{id:'c',nome:'Casa da família Silva'}],saidas:[{id:'s',dia:6,hora:'09:00',localId:'l'}]}};
const pessoas=[{id:'a',nome:'Carlos Teste'},{id:'b',nome:'Bruno Exceção'}];
const salvas=R.recorrenciaCampo({saida:R.saidasCampo(cfg)[0],ano:2026,mes:12,dirigente:'a',aPartirDe:'2026-12-01',hoje:'2026-11-24'});
test('datas numéricas somente no sábado em todos os modelos',()=>{
  const linhas=['2026-12-07','2026-12-05','2026-12-06'].map(data=>({data,datas:[data],hora:'09:00',local:'Local',nome:'Dirigente'}));
  for(const modelo of ['cartoes','editorial','compacto','word','ilustrado']){
    const pdf=Campo.criarPdf(jsPDF,[{data:new Date(2026,11,1),linhas}],'Central',modelo,{}),raw=pdf.output();
    assert(raw.includes('05/12'));assert(!raw.includes('07/12'));assert(!raw.includes('06/12'));
    assert(raw.includes('segunda-feira'));assert(raw.includes('domingo'));assert.equal(pdf.getNumberOfPages(),1);
  }
});
test('recorrência aparece uma vez no mês com todas as datas',()=>{
  const m=Campo.montarMes(new Date(2026,11,1),R,cfg,salvas,pessoas);
  assert.equal(m.linhas.length,1);assert.deepEqual(m.linhas[0].datas,['2026-12-05','2026-12-12','2026-12-19','2026-12-26']);
  assert.equal(m.linhas[0].nome,'Carlos Teste');assert(m.linhas[0].quando.includes('26/12'));
});
test('mudanças de dirigente, local, horário e cancelamento não somem na recorrência',()=>{
  for(const patch of [{dirigente:'b'},{localId:'c'},{hora:'15:00'},{semSaida:true,dirigente:null}]){
    const alteradas=salvas.map((s,i)=>i===1?{...s,...patch}:s);
    const m=Campo.montarMes(new Date(2026,11,1),R,cfg,alteradas,pessoas);
    assert.equal(m.linhas.length,2);assert.equal(m.linhas.flatMap(l=>l.datas).length,4);
    assert.equal(m.linhas.find(l=>l.datas.includes('2026-12-12')).datas.length,1);
  }
});
test('saídas avulsas e sem dirigente não são fundidas; meses não se misturam',()=>{
  assert.equal(Campo.montarMes(new Date(2026,11,1),R,cfg,[],pessoas).linhas.length,4);
  assert.equal(Campo.montarMes(new Date(2027,0,1),R,cfg,salvas,pessoas).linhas.length,5);
  const avulsas=salvas.map(s=>({...s,recorrente:false}));assert.equal(Campo.montarMes(new Date(2026,11,1),R,cfg,avulsas,pessoas).linhas.length,4);
});
for(const modelo of ['cartoes','editorial','compacto','word','ilustrado'])test('campo em '+modelo+' preserva dados, paginação e estado vazio',()=>{
  const m=Campo.montarMes(new Date(2026,11,1),R,cfg,salvas,pessoas);
  const pdf=Campo.criarPdf(jsPDF,[m],'Central',modelo,{}),raw=pdf.output();
  assert(raw.includes('Carlos Teste'));assert(raw.includes('05/12'));assert(raw.includes('26/12'));assert.equal(pdf.getNumberOfPages(),1);
  assert.equal((raw.match(/Carlos Teste/g)||[]).length,1);
  const muitos={...m,linhas:Array.from({length:40},()=>({...m.linhas[0]}))};
  const cheio=Campo.criarPdf(jsPDF,[muitos],'Central',modelo,{});
  assert.equal(cheio.getNumberOfPages(),1);
  assert.equal((cheio.output().match(/Carlos Teste/g)||[]).length,40);
  assert.equal(Campo.criarPdf(jsPDF,[m,m,m],'Central',modelo,{}).getNumberOfPages(),3);
  assert(Campo.criarPdf(jsPDF,[{...m,linhas:[]}],'Central',modelo,{}).output().includes('Nenhuma'));
});
