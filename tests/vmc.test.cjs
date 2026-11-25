const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../designacoes/vmc.js');

// RTF no mesmo formato dos arquivos semanais do jw.org (texto reduzido).
const u=t=>[...t].map(c=>c.charCodeAt(0)>127?'\\u'+c.charCodeAt(0)+'?':c).join('');
const linha=t=>'\\pard\\plain '+u(t)+'\\par\n';
const RTF='{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Times New Roman;}}{\\info{\\title semana}}\n'+[
  '7 a 13 de dezembro','{\\field{\\*\\fldinst HYPERLINK "https://www.jw.org/finder?pub=sjjm"}{\\fldrslt C\\u226?ntico 71 e ora\\\'e7\\\'e3o}}','Comentários iniciais (1 min)',
  'Tesouros da Palavra de Deus','1. Por que não temos medo de pregar? (10 min)','Texto do estudo que não deve ser guardado.','2. Joias espirituais (10 min)','3. Leitura da Bíblia (4 min)',
  'Faça seu melhor no ministério','4. Iniciando conversas (3 min)','De casa em casa. Ofereça um estudo.','5. Iniciando conversas (4 min)','Testemunho público. Use um vídeo.',
  '6. Discurso (5 min)','lmd apêndice A ponto 21 — Tema: O Reino.','7. O que você diria? (5 min)','Consideração.',
  'Nossa vida cristã','Cântico 161','8. Necessidades locais (15 min)','9. Estudo bíblico de congregação (30 min)','Comentários finais (3 min)','Cântico 7 e oração'
].map(t=>t.startsWith('{')?t+'\\par\n':linha(t)).join('')+'}';

test('apostila: RTF vira partes com seção, tipo, cenário e cânticos, sem o texto do estudo',async()=>{
  const A=await import('../api/apostila.js');
  const texto=A.rtfParaTexto(RTF);assert.ok(texto.includes('Cântico 71 e oração'));assert.ok(!texto.some(l=>l.includes('HYPERLINK')));
  const s=A.lerSemana(texto);
  assert.deepEqual(s.canticos,[71,161,7]);
  assert.deepEqual(s.partes.map(p=>[p.n,p.secao,p.tipo,p.min]),[[1,'tesouros','tesouros',10],[2,'tesouros','joias',10],[3,'tesouros','leitura',4],[4,'ministerio','demonstracao',3],[5,'ministerio','demonstracao',4],[6,'ministerio','discurso',5],[7,'ministerio','consideracao',5],[8,'vida','vida',15],[9,'vida','ebc',30]]);
  assert.equal(s.partes[3].cenario,'De casa em casa');assert.equal(s.partes[4].cenario,'Testemunho público');
  assert.ok(!JSON.stringify(s).includes('não deve ser guardado'));
});
test('apostila: datas das semanas, inclusive na virada do ano e com "1.º"',async()=>{
  const A=await import('../api/apostila.js');
  assert.deepEqual(A.lerTituloSemana('16 a 22 de novembro (Lamentações 1 a 2)',2026,11),{semana:'2026-11-16',rotulo:'16 a 22 de novembro',leitura:'Lamentações 1-2'});
  assert.equal(A.lerTituloSemana('28 de dezembro a 3 de janeiro (Ezequiel 9 a 10)',2026,11).semana,'2026-12-28');
  assert.equal(A.lerTituloSemana('29 de dezembro a 4 de janeiro (Ezequiel 11)',2027,1).semana,'2026-12-29');
  assert.equal(A.lerTituloSemana('5 a 11 de janeiro (Ezequiel 12)',2026,11).semana,'2027-01-05');
  assert.equal(A.lerTituloSemana('26 de outubro a 1.º de novembro (Jeremias 47 a 48)',2026,9).semana,'2026-10-26');
  assert.deepEqual(A.edicaoDe('2026-12-09'),{ano:2026,mes:11,codigo:'202611'});assert.equal(A.edicaoDe('2027-01-31').codigo,'202701');
});
test('apostila: busca usa só os arquivos semanais e devolve 404 quando ainda não publicada',async()=>{
  const A=await import('../api/apostila.js');
  const json={formattedDate:'Novembro–dezembro de 2026',files:{T:{RTF:[{title:'Baixar todos (ZIP)',file:{url:'https://x/mwb_T_202611.rtf.zip'}},{title:'7 a 13 de dezembro (Ezequiel 3 a 4)',file:{url:'https://x/mwb_T_202611_05.rtf'}}]}}};
  const urls=[];const fetcher=async url=>{urls.push(url);return url.includes('GETPUBMEDIALINKS')?{ok:true,status:200,json:async()=>json}:{ok:true,status:200,text:async()=>RTF};};
  const r=await A.buscarEdicao('202611',fetcher);
  assert.equal(r.semanas.length,1);assert.equal(r.semanas[0].semana,'2026-12-07');assert.equal(r.semanas[0].leitura,'Ezequiel 3-4');assert.equal(urls.filter(x=>x.endsWith('.zip')).length,0);
  assert.equal(await A.buscarEdicao('202701',async()=>({ok:false,status:404})),null);
});

const pessoa=(id,extra={})=>({id,nome:id,ativo:true,funcoes:{},...extra});
const semana={semana:'2026-12-07',data:'2026-12-09',canticos:[71,161,7],pessoas:{},partes:[
  {n:1,secao:'tesouros',tipo:'tesouros',titulo:'Por que não temos medo de pregar?',min:10},{n:2,secao:'tesouros',tipo:'joias',titulo:'Joias espirituais',min:10},{n:3,secao:'tesouros',tipo:'leitura',titulo:'Leitura da Bíblia',min:4},
  {n:4,secao:'ministerio',tipo:'demonstracao',titulo:'Iniciando conversas',min:3},{n:5,secao:'ministerio',tipo:'discurso',titulo:'Discurso',min:5},
  {n:6,secao:'vida',tipo:'vida',titulo:'Necessidades locais',min:15},{n:7,secao:'vida',tipo:'ebc',titulo:'Estudo bíblico de congregação',min:30}]};

test('vagas: cada parte gera as designações certas (estudante/ajudante, dirigente/leitor, orações)',()=>{
  assert.deepEqual(V.vagas(semana).map(v=>v.chave+':'+v.funcao),['presidente:presidente_vmc','oracao_inicial:oracao_vmc','p1:tesouros','p2:joias','p3:leitura_biblia','p4:estudante','p4a:ajudante','p5:estudante','p6:vida_crista','p7:dirigente_ebc','p7l:leitor_ebc','oracao_final:oracao_vmc']);
});
test('quem pode: funções marcadas, estudantes por padrão, discurso só irmãos e ajudante do mesmo sexo',()=>{
  const ana=pessoa('Ana',{sexo:'F'}),bia=pessoa('Bia',{sexo:'F'}),caio=pessoa('Caio',{sexo:'M'}),eli=pessoa('Eli',{grupo:'anciao',funcoes:{tesouros:true}}),fora=pessoa('Fora',{sexo:'F',funcoes:{estudante:false}});
  const ps=[ana,bia,caio,eli,fora],vs=V.vagas(semana),v=k=>vs.find(x=>x.chave===k);
  assert.deepEqual(ps.filter(p=>V.podeVaga(p,v('p1'),semana,ps)).map(p=>p.id),['Eli']);
  assert.deepEqual(ps.filter(p=>V.podeVaga(p,v('p4'),semana,ps)).map(p=>p.id),['Ana','Bia','Caio','Eli']);
  assert.deepEqual(ps.filter(p=>V.podeVaga(p,v('p5'),semana,ps)).map(p=>p.id),['Caio','Eli']);
  const comAna={...semana,pessoas:{p4:'Ana'}};
  assert.deepEqual(ps.filter(p=>V.podeVaga(p,v('p4a'),comAna,ps)).map(p=>p.id),['Ana','Bia']);
  assert.ok(V.conflitos({semana:{...comAna,pessoas:{p4:'Ana',p4a:'Caio'}},pessoa:caio,vaga:v('p4a'),pessoas:ps}).includes('Estudante e ajudante devem ser do mesmo sexo'));
});
test('sugestão: preenche vagas vazias sem repetir pessoa na reunião e alterna quem fez há mais tempo',()=>{
  const todas={presidente_vmc:true,oracao_vmc:true,tesouros:true,joias:true,leitura_biblia:true,vida_crista:true,dirigente_ebc:true,leitor_ebc:true};
  const ps=['A','B','C','D','E','F','G','H','I','J','K','L','M','N'].map((n,i)=>pessoa(n,{sexo:i<11?'M':'F',funcoes:todas}));
  const anterior={...semana,semana:'2026-11-30',data:'2026-12-02',pessoas:{presidente:'A',p1:'B'}};
  const [s]=V.sugerir({alvo:[{...semana,pessoas:{p2:'J'}}],semanas:[anterior],pessoas:ps});
  const ids=Object.values(s.pessoas);
  assert.equal(new Set(ids).size,ids.length);assert.equal(s.pessoas.p2,'J');
  assert.notEqual(s.pessoas.presidente,'A');assert.notEqual(s.pessoas.p1,'B');
  assert.equal(V.vagas(s).every(v=>s.pessoas[v.chave]),true);
  const sexo=id=>ps.find(p=>p.id===id).sexo;assert.equal(sexo(s.pessoas.p4),sexo(s.pessoas.p4a));
});
test('reimportar mantém designações das partes que não mudaram de tipo',()=>{
  const antiga={...semana,pessoas:{presidente:'A',p4:'B',p4a:'C',p5:'D'}};
  const nova={...semana,partes:semana.partes.map(p=>p.n===5?{...p,tipo:'demonstracao',titulo:'Cultivando o interesse'}:p)};
  assert.deepEqual(V.mesclarImportacao(nova,antiga).pessoas,{presidente:'A',p4:'B',p4a:'C',p5:'D'});
  const troca={...semana,partes:semana.partes.map(p=>p.n===4?{...p,tipo:'consideracao'}:p)};
  assert.deepEqual(V.mesclarImportacao(troca,antiga).pessoas,{presidente:'A',p5:'D'});
});
test('programa calcula horários a partir do início e numera as partes do ministério',()=>{
  const l=V.programa(semana,'19:30').filter(x=>!x.secao);
  assert.deepEqual(l.map(x=>x.hora+' '+x.texto),['19:30 Cântico 71','19:35 Comentários iniciais','19:36 Por que não temos medo de pregar?','19:46 Joias espirituais','19:56 Leitura da Bíblia','20:01 4-Iniciando conversas','20:05 5-Discurso','20:11 Cântico 161','20:16 Necessidades locais','20:31 Estudo bíblico de congregação','21:01 Comentários finais','21:04 Cântico 7']);
  assert.equal(V.programa(semana,'').every(x=>!x.hora),true);
  assert.equal(V.dataReuniao('2026-12-07',3),'2026-12-09');
});
test('PDF da programação do meio de semana é gerado com duas semanas por página',()=>{
  global.window=undefined;const {jsPDF}=require('../assets/js/vendor/jspdf.umd.min.js');const {criarPdfVmc}=require('../designacoes/pdf.js');
  const s={...semana,pessoas:{presidente:'ROBERTO',p4:'BARBARA',p4a:'ANDREIA'}};
  const dados=d=>({data:d,leitura:'Ezequiel 3-4',presidente:'Roberto Santos',linhas:V.programa(s,'19:30').map(l=>l.secao?l:{...l,nomes:l.vagas.map(v=>s.pessoas[v.chave]||''),rotulos:l.vagas.map(v=>v.rotulo)})});
  const pdf=criarPdfVmc(jsPDF,[dados('2026-12-09'),dados('2026-12-16'),dados('2026-12-23'),{data:'2026-12-30',semReuniao:true,motivo:'Assembleia',linhas:[]}],{congregacao:'Bom Jesus de Matozinhos'});
  assert.equal(pdf.getNumberOfPages(),2);
  const out=pdf.output();assert.ok(out.includes('BOM JESUS DE MATOZINHOS'));assert.ok(out.includes('Estudante/Ajudante:'));assert.ok(out.includes('BARBARA/ANDREIA'));
});
