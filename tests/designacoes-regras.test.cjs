const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../designacoes/regras.js');

const pessoas=[
  {id:'a',nome:'Bruno Pinto',grupo:'anciao',funcoes:{presidente:true,leitor:true,audio_video:true,indicadores:true}},
  {id:'b',nome:'Igor Silveira',grupo:'anciao',funcoes:{presidente:true,leitor:true,microfones:true}},
  {id:'c',nome:'José Silva',grupo:'servo',funcoes:{indicadores:true,microfones:true,audio_video:true}},
  {id:'d',nome:'Lucas Tri',grupo:'publicador',funcoes:{indicadores:true,microfones:true,audio_video:true}},
  {id:'e',nome:'Inativo',funcoes:{indicadores:true},ativo:false}
];

test('datas do mês seguem quarta/quinta e o dia do fim de semana',()=>{
  const quinta=R.reunioesDoMes(2026,12,{diaMeio:4,diaFim:6});
  assert.deepEqual(quinta.filter(r=>r.tipo==='meio').map(r=>r.data),['2026-12-03','2026-12-10','2026-12-17','2026-12-24','2026-12-31']);
  assert.deepEqual(quinta.filter(r=>r.tipo==='fim').map(r=>r.data),['2026-12-05','2026-12-12','2026-12-19','2026-12-26']);
  const quarta=R.reunioesDoMes(2026,12,{diaMeio:3,diaFim:0});
  assert.equal(quarta[0].data,'2026-12-02');assert.equal(quarta[1].data,'2026-12-06');
  // Usa a regra do Oradores (domingo em 2027) quando disponível.
  const r2027=R.reunioesDoMes(2027,1,{diaMeio:4,oradores:{dia:6,dia2027:0}});
  assert.equal(r2027.find(r=>r.tipo==='fim').data,'2027-01-03');
  // Reunião remarcada (salva em outro dia) também aparece.
  const salvas=[{data:'2026-12-09',tipo:'meio',pessoas:{}}];
  assert.ok(R.reunioesDoMes(2026,12,{diaMeio:4,diaFim:6},salvas).some(r=>r.data==='2026-12-09'));
});

test('tempo sem fazer a função',()=>{
  const reunioes=[{data:'2026-10-03',tipo:'fim',pessoas:{presidente:['a']}},{data:'2026-10-24',tipo:'fim',pessoas:{presidente:['a']}},{data:'2026-10-31',tipo:'fim',semReuniao:true,pessoas:{presidente:['b']}}];
  assert.equal(R.ultimaVez(reunioes,'a','presidente','2026-11-14'),'2026-10-24');
  assert.equal(R.ultimaVez(reunioes,'b','presidente','2026-11-14'),null,'reunião cancelada não conta');
  assert.equal(R.tempoSem('2026-10-24','2026-11-14'),'há 3 semanas');
  assert.equal(R.tempoSem(null,'2026-11-14'),'nunca fez');
  assert.equal(R.tempoSem('2026-05-01','2026-11-14'),'há 6 meses');
});

test('avisos de conflito',()=>{
  const reuniao={data:'2026-11-14',tipo:'fim',pessoas:{presidente:['a'],audio_video:['a']}};
  const anterior={data:'2026-11-07',tipo:'fim',pessoas:{presidente:['a']}};
  const oradores={programa:[{data:'2026-11-14',nome:'bruno  pinto'}],discursantes:[{nome:'Bruno Pinto',saidas:[{data:'2026-11-14',destino:'Central'}]}]};
  const avisos=R.conflitos({reuniao,pessoa:pessoas[0],funcao:'presidente',reunioes:[anterior,reuniao],oradores});
  assert.ok(avisos.some(a=>a.includes('Já está como Áudio e vídeo')));
  assert.ok(avisos.some(a=>a.includes('orador do discurso público')));
  assert.ok(avisos.some(a=>a.includes('discurso fora')&&a.includes('Central')));
  assert.ok(avisos.some(a=>a.includes('reunião anterior (07/11)')));
  assert.deepEqual(R.conflitos({reuniao,pessoa:pessoas[1],funcao:'leitor',reunioes:[reuniao],oradores:{}}),[]);
});

test('sugestão preenche vagas sem conflito e alterna as pessoas',()=>{
  const cfg={quantidades:{fim:{presidente:1,leitor:1,indicadores:1,microfones:1,audio_video:1}}};
  const alvo=[{data:'2026-11-07',tipo:'fim',pessoas:{}},{data:'2026-11-14',tipo:'fim',pessoas:{}}];
  const oradores={programa:[{data:'2026-11-14',nome:'Igor Silveira'}]};
  const [s1,s2]=R.sugerir({reunioesAlvo:alvo,todas:[],pessoas,cfg,oradores});
  // Ninguém aparece duas vezes na mesma reunião.
  [s1,s2].forEach(r=>{const ids=Object.values(r.pessoas).flat().filter(Boolean);assert.equal(new Set(ids).size,ids.length);});
  // Igor é o orador do dia 14 e não é sugerido nessa data.
  assert.ok(!Object.values(s2.pessoas).flat().includes('b'));
  // Presidente alterna entre as semanas quando possível.
  assert.notEqual(s1.pessoas.presidente[0],null);
  // Inativo nunca é sugerido.
  assert.ok(![s1,s2].some(r=>Object.values(r.pessoas).flat().includes('e')));
  // Vagas já preenchidas são mantidas.
  const [mantida]=R.sugerir({reunioesAlvo:[{data:'2026-11-21',tipo:'fim',pessoas:{presidente:['b']}}],todas:[],pessoas,cfg});
  assert.deepEqual(mantida.pessoas.presidente,['b']);
});

test('Zoom semanal: par da semana e mesma pessoa nas duas reuniões',()=>{
  const cfg={diaMeio:3,diaFim:6,quantidades:{meio:{indicadores:0,microfones:0,audio_video:0,zoom:1},fim:{presidente:0,leitor:0,indicadores:0,microfones:0,audio_video:0,zoom:1}}};
  assert.equal(R.parSemanal('2026-11-04','meio',cfg),'2026-11-07');
  assert.equal(R.parSemanal('2026-11-07','fim',cfg),'2026-11-04');
  assert.equal(R.parSemanal('2026-12-31','meio',{diaMeio:4,diaFim:0}),'2027-01-03','vira o ano');
  assert.equal(R.segundaDaSemana('2026-11-07'),'2026-11-02');
  const ps=[{id:'h',nome:'Henrique',funcoes:{zoom:true}},{id:'r',nome:'Ramon',funcoes:{zoom:true}}];
  const alvo=[{data:'2026-11-04',tipo:'meio',pessoas:{}},{data:'2026-11-07',tipo:'fim',pessoas:{}},{data:'2026-11-11',tipo:'meio',pessoas:{}},{data:'2026-11-14',tipo:'fim',pessoas:{}}];
  const s=R.sugerir({reunioesAlvo:alvo,todas:[],pessoas:ps,cfg});
  assert.deepEqual(s[0].pessoas.zoom,s[1].pessoas.zoom,'mesma pessoa na semana 1');
  assert.deepEqual(s[2].pessoas.zoom,s[3].pessoas.zoom,'mesma pessoa na semana 2');
  assert.notDeepEqual(s[0].pessoas.zoom,s[2].pessoas.zoom,'alterna entre as semanas');
  const separado=R.sugerir({reunioesAlvo:alvo.slice(0,2),todas:[],pessoas:ps,cfg:{...cfg,zoomSemanal:false}});
  assert.notDeepEqual(separado[0].pessoas.zoom,separado[1].pessoas.zoom,'desligado, alterna normalmente');
  assert.equal(R.rotuloVaga('indicadores',0,2),'Auditório');assert.equal(R.rotuloVaga('microfones',1,2),'Microfone 2');
  assert.equal(R.rotuloVaga('indicadores',2,3),'Indicadores 3');assert.equal(R.rotuloVaga('zoom',0,1),'Indicador do Zoom');
});

test('quantidades: padrão e personalizada',()=>{
  assert.equal(R.quantidades({}).meio.indicadores,2);
  assert.equal(R.quantidades({quantidades:{meio:{indicadores:4}}}).meio.indicadores,4);
  assert.equal(R.quantidades({quantidades:{meio:{indicadores:-1}}}).meio.indicadores,2);
  assert.equal(R.quantidades({}).meio.presidente,undefined,'meio de semana não tem presidente');
});
test('fim de semana tem oração inicial e o dirigente de A Sentinela fixo não entra em outras funções',()=>{
  const R2=require('../designacoes/regras.js');
  assert.ok(R2.FUNCOES_POR_TIPO.fim.includes('oracao'));assert.equal(R2.quantidades({}).fim.oracao,1);assert.ok(!R2.FUNCOES_POR_TIPO.meio.includes('oracao'));
  const todas={presidente:true,oracao:true,leitor:true,indicadores:true};
  const ps=[{id:'dir',nome:'Ramon',funcoes:todas},{id:'sub',nome:'Douglas',funcoes:todas},{id:'c',nome:'Carlos',funcoes:todas}];
  const cfg={dirigenteSentinela:'dir',dirigenteSentinelaSubstituto:'sub'},fim={data:'2026-12-12',tipo:'fim',pessoas:{}},meio={data:'2026-12-09',tipo:'meio',pessoas:{}};
  const ids=(reuniao,oradores={})=>R2.candidatos({reuniao,funcao:'indicadores',pessoas:ps,reunioes:[],oradores,cfg}).map(c=>c.pessoa.id);
  assert.deepEqual(ids(fim),['c','sub']);
  assert.deepEqual(ids(meio).sort(),['c','dir','sub']);
  // Com discurso fora, o substituto dirige e quem fica livre é o titular (que está fora: aviso de discurso).
  const oradores={discursantes:[{nome:'Ramon',saidas:[{data:'2026-12-12',destino:'Central'}]}]};
  assert.deepEqual(R2.dirigenteSentinela('2026-12-12',cfg,ps,oradores),{id:'sub',substituindo:true,titular:'dir'});
  assert.deepEqual(ids(fim,oradores).sort(),['c','dir']);
  assert.ok(R2.conflitos({reuniao:fim,pessoa:ps[0],funcao:'indicadores',oradores,cfg,pessoas:ps}).some(a=>a.startsWith('Tem discurso fora')));
  const [s]=R2.sugerir({reunioesAlvo:[fim],todas:[],pessoas:ps,cfg:{...cfg,quantidades:{fim:{presidente:1,oracao:1,leitor:0,indicadores:0,zoom:0,microfones:0,audio_video:0}}},oradores:{}});
  assert.ok(!Object.values(s.pessoas).flat().includes('dir'));
});
