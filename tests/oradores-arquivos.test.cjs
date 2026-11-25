const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../assets/js/features/arquivos.js');

test('campo de arquivo só na semana do discurso (de segunda até o dia)',()=>{
  assert.equal(A.naSemana('2026-11-28','2026-11-23'),true,'segunda da mesma semana');
  assert.equal(A.naSemana('2026-11-28','2026-11-28'),true,'no dia do discurso');
  assert.equal(A.naSemana('2026-11-28','2026-11-29'),false,'depois do discurso');
  assert.equal(A.naSemana('2026-11-28','2026-11-22'),false,'semana anterior');
  assert.equal(A.naSemana('2026-11-29','2026-11-23'),true,'discurso no domingo');
});
test('arquivos de semanas passadas são considerados vencidos',()=>{
  assert.equal(A.vencido('2026-11-22','2026-11-24'),true);
  assert.equal(A.vencido('2026-11-23','2026-11-24'),false);
  assert.equal(A.vencido('2026-11-28','2026-11-30'),true,'na segunda seguinte o arquivo de sábado vence');
  assert.equal(A.vencido('lixo','2026-11-24'),false);
});
test('só aceita .jwpub e .jwlplaylist até 50 MB',()=>{
  assert.equal(A.validar({name:'Discurso.JWPUB',size:10}),'');
  assert.equal(A.validar({name:'lista.jwlplaylist',size:10}),'');
  assert.match(A.validar({name:'video.mp4',size:10}),/só arquivos/);
  assert.match(A.validar({name:'a.jwpub',size:51*1024*1024}),/50 MB/);
  assert.match(A.validar({name:'a.jwpub',size:0}),/vazio/);
  assert.equal(A.nomeExibido(A.nomeSeguro('Discurso Ação.jwpub').replace(/^/,'abc123-')),'Discurso_Acao.jwpub');
});
