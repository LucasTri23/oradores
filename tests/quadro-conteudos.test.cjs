const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../designacoes/regras.js'),QuadroDados=require('../assets/shared/quadro-dados.js'),PdfDesignacoes=require('../designacoes/pdf.js');
const {jsPDF}=require('../assets/js/vendor/jspdf.umd.min.js');
const base={data:new Date(2026,10,1),regras:R,cfg:{diaMeio:3},cfgOradores:{dia:6},pessoas:[{id:'p1',nome:'Carlos Indicador'},{id:'p2',nome:'Ana Microfone'}],reunioes:[{data:'2026-11-07',tipo:'fim',pessoas:{indicadores:['p1'],microfones:['p2'],zoom:['p1']}},{data:'2026-11-11',tipo:'meio',semReuniao:true,motivo:'Assembleia'}],programa:[{data:'2026-11-07',nome:'Orador Teste',congregacao:'Central',tema:'Tema público'}]};

test('quadros usam as funções e os nomes salvos, preservam datas sem reunião e agrupam Zoom',()=>{
  const m=QuadroDados.montarMes(base);
  assert.equal(m.fim.linhas[0].valores[0],'Carlos Indicador');assert.equal(m.fim.linhas[0].valores[2],'Ana Microfone');
  assert(m.meio.linhas.some(r=>r.mesclado==='Assembleia'));assert(m.zoom.some(r=>r.nomes==='Carlos Indicador'));
  assert.equal(m.discursos[0].nome,'Orador Teste');
  assert.equal(QuadroDados.montarMes({...base,incluirDiscursos:false}).discursos,null);
  assert.equal(QuadroDados.montarMes({...base,incluirDesignacoes:false}).fim,null);
});

function tela(conteudo,modelo,acessos={oradores:true,designacoes:true}){
  const elements={},el=id=>elements[id]??={value:'',addEventListener(){}};
  el('quadroConteudo').value=conteudo;
  const records={desig_reunioes:base.reunioes,desig_pessoas:base.pessoas,cong_pessoas:[],desig_config:[{id:'app',diaMeio:3}]};
  const c={PdfPaleta:require('../assets/shared/pdf-paleta.js'),document:{getElementById:el,querySelector:()=>({value:modelo})},window:{quadroAcesso:acessos,addEventListener(){}},Date,Map,
    isoLocal:R.iso,allMeetingDays:y=>R.reunioesDoMes(y,11,{diaFim:6}).map(r=>r.data),
    discursos:[],programa:base.programa,TL:{},cfg:{cong:'Central',dia:6},activeWorkspaceId:'workspace',
    completarDadosPrograma:r=>r,Regras:R,QuadroDados,PdfDesignacoes,
    supabase:{from:()=>({select:()=>({eq:()=>({eq:async(_,col)=>({data:(records[col]||[]).map((r,i)=>({id:r.id||String(i),data:r})),error:null})})})})}};
  vm.createContext(c);vm.runInContext(fs.readFileSync('quadro/quadros.js','utf8'),c);
  return c;
}
for(const conteudo of ['oradores','indicadores','completo'])for(const modelo of ['cartoes','word','ilustrado','editorial','compacto'])test(conteudo+' / '+modelo+' gera PDF com o conteúdo correto',async()=>{
  const c=tela(conteudo,modelo),meses=c.dadosQuadroAnuncios('2026-11',1),pdf=await c.gerarPdfQuadroTela(jsPDF,meses,'Central',false),raw=pdf.output();
  assert(raw.startsWith('%PDF-'));assert(pdf.getNumberOfPages()>0);
  if(conteudo==='indicadores'){assert(raw.includes('Carlos Indicador')||raw.includes('CARLOS INDICADOR'));assert(!raw.includes('Orador Teste'));}
  if(conteudo==='completo'){assert(raw.includes('ORADOR TESTE'));assert(raw.includes('CARLOS INDICADOR'));}
  if(conteudo==='oradores')assert(raw.includes('Orador Teste')||raw.includes('ORADOR TESTE'));
  if(modelo==='ilustrado'&&conteudo!=='completo')assert(!raw.includes('/Subtype /Image'),'ilustração vetorial não usa logo ou imagem raster');
});
test('acesso apenas a Designações gera indicadores e bloqueia quadro completo',async()=>{
  const c=tela('indicadores','word',{oradores:false,designacoes:true}),meses=c.dadosQuadroAnuncios('2026-11',1);
  await c.gerarPdfQuadroTela(jsPDF,meses,'Central',false);
  c.document.getElementById('quadroConteudo').value='completo';await assert.rejects(()=>c.gerarPdfQuadroTela(jsPDF,meses,'Central',false),/acesso/);
});
