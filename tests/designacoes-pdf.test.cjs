const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {jsPDF}=require('../assets/js/vendor/jspdf.umd.min.js');
const {criarPdfDesignacoes,criarPdfTabelas}=require('../designacoes/pdf.js');

test('PDF em cartões mostra funções, nomes e reuniões canceladas',()=>{
  const reunioes=[];
  for(let d=1;d<=30;d+=3)reunioes.push({data:'2026-11-'+String(d).padStart(2,'0'),tipo:d%2?'meio':'fim',linhas:[{funcao:'Presidente',nomes:['Bruno Pinto']},{funcao:'Áudio e vídeo',nomes:['José Silva','Lucas Tri']},{funcao:'Indicadores',nomes:[]}]});
  reunioes.push({data:'2026-11-29',tipo:'fim',semReuniao:true,motivo:'Assembleia de circuito',linhas:[]});
  const pdf=criarPdfDesignacoes(jsPDF,[{data:new Date(2026,10,1),reunioes}],'Central');
  const txt=pdf.output();
  assert.ok(txt.includes('Bruno Pinto'));
  assert.ok(txt.includes('PRESIDENTE'));
  assert.ok(txt.includes('A definir'),'função sem nomes aparece como A definir');
  assert.ok(txt.includes('Assembleia de circuito'));
  assert.ok(pdf.getNumberOfPages()>=2,'muitas reuniões quebram a página');
});

// Mesmo conteúdo do modelo em Word (novembro/2026).
const novembro={
  data:new Date(2026,10,1),
  discursos:[{data:'07/11',nome:'Adriano Araujo',cong:'Minas Caixa - Belo Horizonte',tema:'Viva com bom juízo num mundo depravado'},{data:'14/11',nome:'Luiz Paulo',cong:'Parque Andyara – Pedro Leopoldo',tema:'Ande no caminho da integridade'},{data:'21/11',mesclado:'Visita do superintendente'},{data:'28/11',nome:'Diego de Oliveira',cong:'Tirol - Belo Horizonte',tema:'Você vai sobreviver aos últimos dias?'}],
  presidencia:[{data:'07/11',presidente:'Roberto Santos',leitor:'Roberto Cândido'},{data:'14/11',presidente:'Odilon Alves',leitor:'Adilson'},{data:'21/11',presidente:'Wellington Gonçalves',leitor:''},{data:'28/11',presidente:'Rafael Silva',leitor:'Marcelo Ângelo'}],
  fim:{grupos:[{titulo:'Indicadores',vagas:['Auditório','Entrada']},{titulo:'Microfones',vagas:['Microfone 1','Microfone 2']}],linhas:[{data:'07/11',valores:['Wellington','Edvaldo','Tulio','Luiz']},{data:'14/11',valores:['Rafael','Eraldo','Miguel Ribeiro','Alexandre']},{data:'21/11',valores:['Jalson','Henrique','Miguel Gonçalves','Douglas']},{data:'28/11',valores:['Roberto Cândido','Adilson','Douglas','Carlos']}]},
  meio:{grupos:[{titulo:'Indicadores',vagas:['Auditório','Entrada']},{titulo:'Microfones',vagas:['Microfone 1','Microfone 2']}],linhas:[{data:'04/11',valores:['Edvaldo','Wellington','Luiz','Tulio']},{data:'11/11',valores:['Eraldo','Rafael','Alexandre','Miguel Ribeiro']},{data:'18/11',valores:['Henrique','Jalson','Douglas','Miguel Gonçalves']},{data:'25/11',mesclado:'Assembleia de circuito'}]},
  zoom:[{rotulo:'04 e 07/11',nomes:'Henrique'},{rotulo:'11 e 14/11',nomes:'Ramon Oliveira'},{rotulo:'18 e 21/11',nomes:'Luiz'},{rotulo:'25 e 28/11',nomes:'Marcelo Ribeiro'}]
};

test('PDF em tabelas tem todas as seções do modelo em Word, em maiúsculas',()=>{
  const pdf=criarPdfTabelas(jsPDF,[novembro],{congregacao:'Bom Jesus – Matozinhos/MG',endereco:'Rua Amazonas, 121, Bom Jesus I – Matozinhos, MG'});
  const txt=pdf.output();
  ['DISCURSOS P','PRESIDENTE','LEITOR','AUDIT','ENTRADA','MICROFONE 1','INDICADORES DO ZOOM','ADRIANO ARAUJO','VISITA DO SUPERINTENDENTE','MARCELO RIBEIRO','25 E 28/11','ASSEMBLEIA DE CIRCUITO'].forEach(t=>assert.ok(txt.includes(t),'faltou '+t));
  assert.ok(txt.includes('Rua Amazonas'),'endereço no rodapé');
  assert.equal(pdf.getNumberOfPages(),1,'um mês cabe em uma página');
  if(process.env.SALVAR_PDF)fs.writeFileSync(process.env.SALVAR_PDF,Buffer.from(pdf.output('arraybuffer')));
});

test('PDF em tabelas pula seções vazias (sem acesso ao Oradores, sem Zoom)',()=>{
  const pdf=criarPdfTabelas(jsPDF,[{...novembro,discursos:null,zoom:null},{...novembro,data:new Date(2026,11,1)}],{congregacao:'Central'});
  assert.equal(pdf.getNumberOfPages(),2,'uma página por mês');
});
