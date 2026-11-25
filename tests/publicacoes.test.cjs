const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../publicacoes/regras.js');
const base=tipo=>({id:'p',revision:0,nome:tipo==='pessoa'?'Maria':'Central',solicitanteTipo:tipo,data:'2026-11-25',itens:[{codigo:'lff',titulo:'Seja Feliz',idioma:'Português (Brasil)',formato:'',quantidade:5,enviado:0,recebido:0,entregue:0}],eventos:[]});
test('pedido parcial de pessoa acompanha envio, recebimento e entrega sem alterar estoque',()=>{
  const estoque={mes:'2026-10',itens:[{codigo:'lff',quantidade:2}]},antes=JSON.stringify(estoque);let p=base('pessoa');
  assert.equal(R.situacao(p),'A enviar');p=R.movimentar(p,'enviado',[3],'u');assert.equal(R.situacao(p),'Enviado parcialmente');
  p=R.movimentar(p,'recebido',[2],'u');assert.equal(R.situacao(p),'Recebido parcialmente');
  p=R.movimentar(p,'entregue',[1],'u');assert.equal(p.itens[0].entregue,1);
  p=R.movimentar(p,'enviado',[2],'u');p=R.movimentar(p,'recebido',[3],'u');assert.equal(R.situacao(p),'Pronto para retirar');
  p=R.movimentar(p,'entregue',[4],'u');assert.equal(R.situacao(p),'Entregue');assert.equal(JSON.stringify(estoque),antes);assert.equal(p.eventos.length,6);
});
test('pedido da congregação termina no recebimento e bloqueia entregas e quantidades inválidas',()=>{
  let p=base('congregacao');assert.throws(()=>R.movimentar(p,'recebido',[1],'u'),/quantidades/);
  for(const q of [-1,1.5,'',1000001])assert.throws(()=>R.movimentar(p,'enviado',[q],'u'));
  assert.throws(()=>R.movimentar(p,'enviado',[6],'u'));assert.throws(()=>R.movimentar(p,'enviado',[0],'u'));
  p=R.movimentar(p,'enviado',[5],'u');assert.equal(R.situacao(p),'Aguardando chegada');p=R.movimentar(p,'recebido',[5],'u');assert.equal(R.situacao(p),'Recebido');
  assert.throws(()=>R.movimentar(p,'entregue',[1],'u'),/congregação/);
});
test('cancelamento preserva pedido e exige conferência quando já enviado ao Hub',()=>{
  const p=base('pessoa'),cancelado=R.cancelar(p,'u');assert.equal(R.situacao(cancelado),'Cancelado');assert.equal(p.cancelado,undefined);assert.throws(()=>R.movimentar(cancelado,'enviado',[1],'u'),/cancelado/);
  assert.throws(()=>R.cancelar(R.movimentar(p,'enviado',[1],'u'),'u'),/enviado ao JW Hub/);
});
test('publicações repetidas são rejeitadas, formatos e idiomas distintos são mantidos',()=>{
  const p=base('pessoa');assert.throws(()=>R.validarItens([p.itens[0],{...p.itens[0],codigo:' LFF '}]),/repetidas/);
  assert.equal(R.validarItens([p.itens[0],{...p.itens[0],formato:'Letras grandes'}]).length,2);assert.throws(()=>R.validarPedido({...p,nome:''}),/solicitou/);
});
test('movimento mensal reconhece referência, estoque zero, médias em parênteses e linhas não reconhecidas',()=>{
  const r=R.lerMovimento(['MOVIMENTO MENSAL DE PUBLICAÇÕES','Outubro de 2026 | Português (Brasil)','Livros','(lff) Seja Feliz para Sempre! (livro) 2 1','(nwt) Tradução do Novo Mundo 0 0','(wp18.3) A Sentinela (público) 103 (6)','(erro) Texto quebrado']);
  assert.equal(r.mes,'2026-10');assert.equal(r.itens.length,3);assert.equal(r.itens[1].quantidade,0);assert.equal(r.itens[2].media,'(6)');assert.equal(r.avisos.length,1);
  assert.throws(()=>R.lerMovimento(['Histórico de pedidos']),/Movimento mensal/);
});
test('leitura de texto PDF reagrupa colunas e páginas sem trocar códigos e quantidades',()=>{
  const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]});const linhas=R.linhasPagina([item('2',297,200),item('(lff) Seja Feliz',35,200),item('1',396,200),item('Livros',35,240)]);
  assert.deepEqual(linhas,['Livros','(lff) Seja Feliz 2 1']);
});
test('SQL independente inclui permissões, arquivos privados e proteção contra gravações concorrentes',()=>{
  const sql=fs.readFileSync('publicacoes/migration.sql','utf8');assert(sql.includes("left(coll,4)='pub_'"));assert(sql.includes("can_write_module(target_workspace,'publicacoes')"));assert(sql.includes('expected_revision'));assert(sql.includes('for update'));assert(sql.includes('Pedido alterado por outra pessoa'));assert(sql.includes("'publicacoes','publicacoes',false"));assert(!/\bas \$(?!\$)|\bend \$(?!\$);/.test(sql),'delimitadores SQL completos');assert(!sql.includes("$$'"),'âncoras de expressões regulares preservadas');
});
