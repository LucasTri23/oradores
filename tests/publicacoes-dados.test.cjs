const {test}=require('node:test'),assert=require('node:assert/strict');
global.PublicacoesRegras=require('../publicacoes/regras.js');const Dados=require('../publicacoes/dados.js');
function banco({rpcError=null,uploadError=null}={}){const calls=[];return {calls,sb:{from(){return {select(){return this;},eq(){return this;},then(ok){return Promise.resolve({data:[{id:'2026-10',data:{mes:'2026-10',itens:[]}}]}).then(ok);}};},async rpc(name,args){calls.push({name,args});return {data:3,error:rpcError};},storage:{from(bucket){return {upload:async(path,file)=>{calls.push({upload:path,bucket});return {error:uploadError};},remove:async paths=>{calls.push({remove:paths});return {};}};}}}};}
const permissions={podeVer:()=>true,podeEditar:()=>true},vinc={workspaceId:'congregacao'},user={id:'u',email:'u@example.invalid'};
const pedido={id:'p',revision:2,nome:'Pessoa',solicitanteTipo:'pessoa',data:'2026-11-25',itens:[{codigo:'lff',titulo:'Livro',idioma:'Português',quantidade:2,enviado:1,recebido:0,entregue:0}]};
test('salvar pedido usa revisão esperada e nunca grava na coleção de estoque',async()=>{
  const b=banco(),store=Dados.criar(b.sb,vinc,user,permissions),saved=await store.pedido(pedido);
  assert.equal(saved.revision,3);assert.equal(b.calls.length,1);assert.equal(b.calls[0].name,'save_publication_order');assert.equal(b.calls[0].args.expected_revision,2);assert.equal(b.calls[0].args.target_workspace,'congregacao');assert.equal(b.calls[0].args.payload.revision,undefined);
});
test('somente leitura não importa arquivos nem altera pedidos; leitura sem permissão é bloqueada',async()=>{
  const b=banco(),store=Dados.criar(b.sb,vinc,user,{podeVer:()=>true,podeEditar:()=>false});
  await assert.rejects(store.pedido(pedido),/somente/);await assert.rejects(store.importar({itens:[]},{},0),/somente/);assert.equal(b.calls.length,0);
  await assert.rejects(Dados.criar(b.sb,vinc,user,{podeVer:()=>false}).listar('pub_pedidos'),/Sem acesso/);
});
test('falha de concorrência preserva pedido e solicita atualização',async()=>{
  const b=banco({rpcError:{message:'Pedido alterado por outra pessoa'}});await assert.rejects(Dados.criar(b.sb,vinc,user,permissions).pedido(pedido),/outra pessoa/);assert.equal(pedido.revision,2);
});
test('importação substitui o mês pela revisão, preserva quantidades absolutas e remove upload se falhar',async()=>{
  const relatorio={mes:'2026-10',itens:[{codigo:'lff',titulo:'Livro',idioma:'Português',quantidade:2}]};
  const b=banco(),store=Dados.criar(b.sb,vinc,user,permissions);await store.importar(relatorio,{name:'relatorio.pdf'},2);
  assert.equal(b.calls[0].bucket,'publicacoes');assert.match(b.calls[0].upload,/^congregacao\/2026-10\//);assert.equal(b.calls[1].name,'save_publication_inventory');assert.equal(b.calls[1].args.expected_revision,2);assert.equal(b.calls[1].args.payload.itens[0].quantidade,2);
  const failed=banco({rpcError:{message:'erro',code:'P0001'}});await assert.rejects(Dados.criar(failed.sb,vinc,user,permissions).importar(relatorio,{name:'relatorio.pdf'},2));assert.equal(failed.calls[2].remove[0],failed.calls[0].upload);
  const network=banco({rpcError:{message:'Failed to fetch',code:''}});await assert.rejects(Dados.criar(network.sb,vinc,user,permissions).importar(relatorio,{name:'relatorio.pdf'},2));assert.equal(network.calls.length,2,'uma resposta incerta não apaga o PDF de um relatório possivelmente salvo');
});
