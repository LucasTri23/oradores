const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../designacoes/regras.js');

const x={id:'x',nome:'Pessoa X',funcoes:{microfones:true,audio_video:true,dirigente_campo:true}};
const y={id:'y',nome:'Pessoa Y',funcoes:{microfones:true,audio_video:true,dirigente_campo:true}};

test('Áudio na quarta não conta como Microfone em outra reunião (validação por função)',()=>{
  const reunioes=[{data:'2026-11-18',tipo:'meio',pessoas:{audio_video:['x']}}];
  for(const r of [{data:'2026-11-21',tipo:'fim',pessoas:{}},{data:'2026-11-25',tipo:'meio',pessoas:{}}]){
    const c=R.candidatos({reuniao:r,funcao:'microfones',pessoas:[x,y],reunioes,oradores:{}}).find(c=>c.pessoa.id==='x');
    assert.equal(c.ultima,null,'nunca fez Microfones');
    assert.deepEqual(c.avisos,[],'sem aviso em '+r.data);
  }
  // Na reunião seguinte do mesmo tipo, o aviso de "reunião anterior" só vale para a MESMA função.
  const av=R.conflitos({reuniao:{data:'2026-11-25',tipo:'meio',pessoas:{}},pessoa:x,funcao:'audio_video',reunioes,oradores:{}});
  assert.deepEqual(av,['Fez Áudio e vídeo na reunião anterior (18/11)']);
  assert.equal(R.ultimaVez(reunioes,'x','microfones','2026-12-31'),null);
  assert.equal(R.ultimaVez(reunioes,'x','audio_video','2026-12-31'),'2026-11-18');
});

test('duas funções na mesma reunião geram aviso claro (permitido)',()=>{
  const r={data:'2026-11-18',tipo:'meio',pessoas:{audio_video:['x']}};
  assert.deepEqual(R.conflitos({reuniao:r,pessoa:x,funcao:'microfones',reunioes:[r],oradores:{}}),['Já está como Áudio e vídeo nesta reunião']);
});

const cfg={campo:{locais:[{id:'l1',nome:'Salão do Reino'},{id:'l2',nome:'Casa da família Souza'}],saidas:[{id:'s1',dia:6,hora:'09:00',localId:'l1'},{id:'s2',dia:6,hora:'15:00',localId:'l2'},{id:'s3',dia:3,hora:'08:30',localId:'l1'},{id:'ruim',dia:9,hora:'x'}]}};

test('saídas configuradas: várias no mesmo dia, inválidas ignoradas',()=>{
  const s=R.saidasCampo(cfg);
  assert.deepEqual(s.map(x=>x.id),['s3','s1','s2']);
  const dez=R.campoDoMes(2026,12,cfg);
  assert.equal(dez.filter(c=>c.data==='2026-12-05').length,2);
  assert.equal(dez.filter(c=>c.saidaId==='s3').length,5,'5 quartas em dezembro de 2026');
  // Designação salva de saída removida continua visível.
  const salvas=[{data:'2026-12-01',saidaId:'antiga',hora:'10:00',dirigente:'x'}];
  assert.ok(R.campoDoMes(2026,12,cfg,salvas).find(c=>c.saidaId==='antiga').removida);
});

test('recorrência no mês preenche todas as datas daquela saída a partir de hoje',()=>{
  const saida=R.saidasCampo(cfg).find(s=>s.id==='s1');
  const r=R.recorrenciaCampo({saida,ano:2026,mes:12,dirigente:'y',aPartirDe:'2026-11-24',hoje:'2026-11-24'});
  assert.deepEqual(r.map(c=>c.data),['2026-12-05','2026-12-12','2026-12-19','2026-12-26']);
  assert.ok(r.every(c=>c.dirigente==='y'&&c.recorrente&&c.id===R.idCampo(c.data,'s1')));
  const nov=R.recorrenciaCampo({saida,ano:2026,mes:11,dirigente:'y',aPartirDe:'2026-11-24',hoje:'2026-11-24'});
  assert.deepEqual(nov.map(c=>c.data),['2026-11-28'],'datas passadas não são alteradas');
});

test('limite de 4 meses para frente',()=>{
  assert.equal(R.limiteCampo('2026-11-24'),'2027-03-31');
  assert.equal(R.dentroDoLimiteCampo('2027-03-27','2026-11-24'),true);
  assert.equal(R.dentroDoLimiteCampo('2027-04-03','2026-11-24'),false);
  const saida=R.saidasCampo(cfg).find(s=>s.id==='s1');
  assert.deepEqual(R.recorrenciaCampo({saida,ano:2027,mes:4,dirigente:'y',aPartirDe:'2026-11-24',hoje:'2026-11-24'}),[]);
});

test('candidatos a dirigente: só quem está marcado, quem dirigiu há mais tempo primeiro, avisos de conflito',()=>{
  const z={id:'z',nome:'Pessoa Z',funcoes:{microfones:true}};
  const campo=[{id:'2026-11-07_s1',data:'2026-11-07',saidaId:'s1',dirigente:'x'},{id:'2026-11-28_s2',data:'2026-11-28',saidaId:'s2',dirigente:'y'}];
  const item={id:'2026-11-28_s1',data:'2026-11-28',saidaId:'s1'};
  const reunioes=[{data:'2026-11-28',tipo:'fim',pessoas:{microfones:['x']}}];
  const c=R.candidatosCampo({item,pessoas:[x,y,z],campo,reunioes});
  assert.deepEqual(c.map(c=>c.pessoa.id),['y','x'],'Z não é dirigente; Y nunca dirigiu antes desta data');
  assert.deepEqual(c.find(c=>c.pessoa.id==='y').avisos,['Já dirige outra saída neste dia']);
  assert.deepEqual(c.find(c=>c.pessoa.id==='x').avisos,['Está como Microfones na reunião deste dia']);
  assert.equal(R.ultimaVezCampo(campo,'x','2026-11-28'),'2026-11-07');
});
