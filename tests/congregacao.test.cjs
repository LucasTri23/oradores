const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../assets/shared/congregacao.js');

const datas={fim:['2026-11-07','2026-11-14','2026-11-21'],meio:['2026-11-04','2026-11-11','2026-11-18']};

test('telefone para o WhatsApp',()=>{
  assert.equal(C.telefoneWa('(31) 99999-8888'),'5531999998888');
  assert.equal(C.telefoneWa('5531999998888'),'5531999998888');
  assert.equal(C.telefoneWa(''),'');
});

test('juntar cadastros sem repetir nomes e mantendo o id das Designações',()=>{
  const r=C.juntarCadastros({
    central:[{id:'c1',nome:'José Silva',telefone:''}],
    designacoes:[{id:'d1',nome:'Bruno Pinto',grupo:'anciao'},{id:'d2',nome:'josé  silva'}],
    dirigentes:[{nome:'Bruno Pinto',num:'5531988887777'},{nome:'Marcelo',num:'5531911112222'}],
    oradores:[{nome:'José Silva',tel:'31977776666'}]
  });
  assert.deepEqual(r.novas.map(p=>p.nome),['Bruno Pinto','Marcelo']);
  assert.equal(r.novas[0].id,'d1','mantém o id da Designação');
  assert.equal(r.novas[0].telefone,'5531988887777','pega o telefone do dirigente');
  assert.equal(r.atualizadas.length,1);assert.equal(r.atualizadas[0].telefone,'31977776666','completa telefone do cadastro central');
});

test('evento marca sem discurso e sem reunião, guardando o que existia',()=>{
  const ev={id:'e1',titulo:'Assembleia de circuito',inicio:'2026-11-14',fim:'2026-11-14',semDiscurso:true,semanaToda:false,temDesignacoes:false};
  const programa=[{id:'p1',data:'2026-11-14',nome:'Adriano',temaNum:10}];
  const reunioes=[{id:'2026-11-14',data:'2026-11-14',tipo:'fim',pessoas:{presidente:['a']}}];
  const p=C.planejarEvento({novo:ev,programa,reunioes,datas});
  assert.deepEqual(p.conflitos,[{data:'2026-11-14',nome:'Adriano'}]);
  assert.equal(p.programaSalvar.length,1);
  const prog=p.programaSalvar[0];
  assert.equal(prog.id,'p1');assert.equal(prog.dados.semDiscurso,true);assert.equal(prog.dados.motivo,'Assembleia de circuito');
  assert.equal(prog.dados.eventoBackup.nome,'Adriano','guarda o orador para voltar depois');
  assert.equal(p.reunioesSalvar.length,1);
  assert.equal(p.reunioesSalvar[0].semReuniao,true);assert.deepEqual(p.reunioesSalvar[0].pessoas,{presidente:['a']},'mantém as pessoas');
  assert.equal(p.reunioesSalvar[0].eventoId,'e1');
});

test('apagar o evento devolve tudo como era',()=>{
  const ev={id:'e1',titulo:'Assembleia',inicio:'2026-11-14',fim:'2026-11-14',semDiscurso:true,semReuniaoFim:true};
  const programa=[{id:'p1',data:'2026-11-14',semDiscurso:true,eventoId:'e1',eventoBackup:{data:'2026-11-14',nome:'Adriano'}},{id:'p2',data:'2026-11-21',semDiscurso:true,eventoId:'e1'}];
  const reunioes=[{id:'2026-11-14',data:'2026-11-14',tipo:'fim',semReuniao:true,motivo:'Assembleia',eventoId:'e1',eventoAntes:{semReuniao:false,motivo:''},pessoas:{}}];
  const p=C.planejarEvento({novo:null,antigo:ev,programa,reunioes,datas});
  assert.deepEqual(p.programaSalvar,[{id:'p1',dados:{data:'2026-11-14',nome:'Adriano'}}],'orador volta');
  assert.deepEqual(p.programaApagar,['p2'],'data criada pelo evento some');
  assert.equal(p.reunioesSalvar[0].semReuniao,false);assert.equal(p.reunioesSalvar[0].eventoId,undefined);
});

test('visita do superintendente: só sem discurso; mudar a data move as marcações',()=>{
  const antigo={id:'v',titulo:'Visita',inicio:'2026-11-17',fim:'2026-11-22',semDiscurso:true};
  const novo={...antigo,inicio:'2026-11-03',fim:'2026-11-08'};
  const programa=[{id:'p21',data:'2026-11-21',semDiscurso:true,motivo:'Visita',eventoId:'v'}];
  const p=C.planejarEvento({novo,antigo,programa,reunioes:[],datas});
  assert.deepEqual(p.programaApagar,['p21']);
  assert.deepEqual(p.programaSalvar.map(x=>x.dados.data),['2026-11-07']);
  assert.equal(p.reunioesSalvar.length,0,'visita não cancela reunião');
});

test('semana toda: ocupa de segunda a domingo e pode ter ou não designações',()=>{
  assert.deepEqual(C.periodo({inicio:'2026-11-18',fim:'2026-11-18',semanaToda:true}),{inicio:'2026-11-16',fim:'2026-11-22'});
  assert.deepEqual(C.periodo({inicio:'2026-11-21',semanaToda:false}),{inicio:'2026-11-21',fim:'2026-11-21'});
  const semDesig={id:'x',titulo:'Congresso',inicio:'2026-11-13',fim:'2026-11-15',semanaToda:true,temDesignacoes:false,semDiscurso:true};
  const p=C.planejarEvento({novo:semDesig,datas});
  assert.deepEqual(p.reunioesSalvar.map(r=>r.data).sort(),['2026-11-11','2026-11-14'],'meio e fim da semana inteira ficam sem reunião');
  const comDesig=C.planejarEvento({novo:{...semDesig,temDesignacoes:true},datas});
  assert.equal(comDesig.reunioesSalvar.length,0,'com designações, as reuniões continuam');
  assert.equal(comDesig.programaSalvar.length,1,'mas o discurso público pode continuar marcado como sem discurso');
  const soDias=C.planejarEvento({novo:{...semDesig,semanaToda:false},datas});
  assert.deepEqual(soDias.reunioesSalvar.map(r=>r.data),['2026-11-14'],'só os dias do evento');
});
test('eventos antigos (sem reunião só no fim de semana) continuam funcionando',()=>{
  const antigo={id:'o',titulo:'Assembleia',inicio:'2026-11-09',fim:'2026-11-15',semReuniaoFim:true,semReuniaoMeio:false};
  assert.deepEqual(C.planejarEvento({novo:antigo,datas}).reunioesSalvar.map(r=>r.data),['2026-11-14']);
});
