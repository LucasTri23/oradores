const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('saída compartilhada só limpa o vínculo depois que o encerramento foi confirmado',async()=>{
  for(const falha of [false,true]){
    const removed=[],c={window:{},localStorage:{removeItem:k=>removed.push(k)}};vm.createContext(c);vm.runInContext(fs.readFileSync('assets/shared/conta.js','utf8'),c);
    const conta=c.window.Conta;conta.usarCliente({auth:{signOut:async()=>({error:falha?{message:'offline'}:null})}});
    if(falha){await assert.rejects(conta.sair(),/encerrar/);assert.equal(removed.length,0);}else{await conta.sair();assert.deepEqual(removed,['oradores_workspace']);}
  }
});
test('Entrar novamente bloqueia clique duplicado e apresenta falha na tela de saída',async()=>{
  const html=fs.readFileSync('index.html','utf8'),fn=html.match(/async function entrar\(botao\)\{[\s\S]*?\n\}/)[0];
  let calls=0,reject;const b={innerHTML:'<span>Entrar novamente</span>',disabled:false,setAttribute(){},removeAttribute(){}};
  const nodes={vSaiu:{hidden:false},saiuErr:{hidden:true},loginErr:{hidden:true}};
  const c={$:id=>nodes[id],Conta:{entrar:()=>{calls++;return new Promise((_,r)=>reject=r);}},location:{origin:'https://example.invalid',search:''},document:{querySelector:()=>b}};
  vm.createContext(c);vm.runInContext(fn,c);const pending=c.entrar(b);assert.equal(b.disabled,true);await c.entrar(b);assert.equal(calls,1);
  reject(new Error('erro técnico'));await pending;assert.equal(b.disabled,false);assert.equal(nodes.saiuErr.hidden,false);assert.equal(nodes.loginErr.hidden,true);assert(!nodes.saiuErr.textContent.includes('erro técnico'));assert.equal(b.innerHTML,'<span>Entrar novamente</span>');
});
test('saída antiga de Oradores também vai para a confirmação e mantém a sessão em caso de erro',async()=>{
  const source=fs.readFileSync('assets/js/supabase-client.js','utf8'),fn=source.match(/async function logout\(\)\{[\s\S]*?\n\}/)[0];
  for(const falha of [false,true]){const redirects=[],messages=[],c={supabase:{auth:{signOut:async()=>({error:falha?{}:null})}},currentUser:{id:'u'},activeWorkspaceId:'w',localStorage:{removeItem(){}},location:{replace:u=>redirects.push(u)},toast:t=>messages.push(t)};vm.createContext(c);vm.runInContext(fn,c);await c.logout();
    if(falha){assert.equal(redirects.length,0);assert.equal(c.currentUser.id,'u');assert.equal(messages.length,1);}else{assert.deepEqual(redirects,['/?saiu=1']);assert.equal(c.currentUser,null);}
  }
});
