const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Acesso=require('../assets/shared/convite.js'),token='11111111-2222-4333-8444-555555555555';
test('convite inválido é bloqueado antes da consulta e os erros não expõem a API',async()=>{
  let calls=0;await assert.rejects(Acesso.aceitar({rpc(){calls++;}},'incompleto'),/link de convite/);assert.equal(calls,0);
  const expirado=Acesso.erroAmigavel({message:'Convite inválido, expirado ou já utilizado'});assert.equal(expirado.indisponivel,true);
  assert.match(Acesso.erroAmigavel({message:'Esta conta já está vinculada a outra congregação'}).message,/outra conta Google/);
  assert.equal(Acesso.erroAmigavel({message:'Entre com Google para aceitar'}).sessaoExpirada,true);
  assert(!Acesso.erroAmigavel({message:'HTTP 500 sensitive error'}).message.includes('HTTP'));
});
function setup({connected=true,failure=null}={}){
  const nodes={},changes=[],calls=[],logins=[];
  const node=()=>({children:[],hidden:false,disabled:false,textContent:'',appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];},querySelector(){return {cloneNode:()=>node()};},setAttribute(){},removeAttribute(){},focus(){}});
  const $=id=>nodes[id]??=node();const location={search:'?equipe='+token,pathname:'/',hash:'',replace:u=>changes.push(u)};
  const c={$: $,mostrar:id=>changes.push(id),document:{createElement:node},user:connected?{id:'u',email:'pessoa@example.invalid'}:null,ConviteAcesso:Acesso,URLSearchParams,location,
    history:{replaceState(_,__,url){changes.push(url);location.search=new URL(url,'https://example.invalid').search;}},
    Conta:{supabase:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:'workspace',error:failure};}}),sair:async()=>{}},entrar:async b=>logins.push(b)};
  const source=fs.readFileSync('index.html','utf8'),start=source.indexOf('let conviteAceito='),end=source.indexOf('// ── Navegação',start);assert(end>start);
  vm.createContext(c);vm.runInContext(source.slice(start,end),c);return {c,$,calls,changes,logins};
}
test('abrir convite não o consome: usuário vê a conta e precisa confirmar',async()=>{
  const {c,$,calls}=setup();c.mostrarConvite();assert.equal(calls.length,0);assert.equal($('conviteEmail').textContent,'pessoa@example.invalid');assert.equal($('conviteAcao').children[0].textContent,'Aceitar convite');
  await c.acaoConvite($('conviteAcao'));assert.equal(calls.length,1);assert.equal(calls[0].name,'accept_workspace_invite');assert.equal(c.location.search,'');assert.equal($('conviteTitulo').textContent,'Convite aceito.');assert.equal($('conviteAcao').children[0].textContent,'Abrir congregação');
});
test('sem login o convite conduz ao Google sem aceitar nem perder o token',async()=>{
  const {c,$,calls,logins}=setup({connected:false});c.mostrarConvite();await c.acaoConvite($('conviteAcao'));assert.equal(logins.length,1);assert.equal(calls.length,0);assert(c.location.search.includes(token));
});
test('falha de conexão preserva convite para nova tentativa; convite expirado fica indisponível',async()=>{
  const first=setup({failure:{message:'Failed to fetch'}});first.c.mostrarConvite();await first.c.acaoConvite(first.$('conviteAcao'));assert(first.c.location.search.includes(token));assert.equal(first.$('conviteAcao').disabled,false);assert.equal(first.$('conviteErr').hidden,false);
  const expired=setup({failure:{message:'Convite expirado ou já utilizado'}});expired.c.mostrarConvite();await expired.c.acaoConvite(expired.$('conviteAcao'));assert.equal(expired.$('conviteAcao').disabled,true);assert.equal(expired.$('conviteTitulo').textContent,'Convite indisponível.');
});
test('trocar conta mantém o convite e bloqueia clique duplicado durante o aceite',async()=>{
  const first=setup();first.c.mostrarConvite();await first.c.trocarContaConvite();assert.equal(first.c.user,null);assert(first.c.location.search.includes(token));
  const second=setup();let resolve;second.c.Conta.supabase=async()=>({rpc:()=>new Promise(r=>resolve=r)});const one=second.c.aceitarConvite(new URLSearchParams(second.c.location.search));await new Promise(r=>setImmediate(r));await second.c.aceitarConvite(new URLSearchParams(second.c.location.search));resolve({data:'w',error:null});await one;assert.equal(second.$('conviteTitulo').textContent,'Convite aceito.');
});

test('convites antigos do Oradores abrem a nova tela antes de carregar o módulo',async()=>{
  const fn=fs.readFileSync('assets/js/supabase-client.js','utf8').match(/async function checkSetup\(\)\{[\s\S]*?\n\}/)[0],redirects=[];
  const c={URLSearchParams,location:{search:'?equipe='+token,replace:p=>redirects.push(p)}};vm.createContext(c);vm.runInContext(fn,c);await c.checkSetup();
  const url=new URL(redirects[0],'https://example.invalid');assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('equipe'),token);assert.equal(url.searchParams.get('voltar'),'/oradores');
});

test('consulta do nome funciona sem login, exige token válido e não aceita o convite',async()=>{
  const calls=[],sb={rpc:async(name,args)=>{calls.push({name,args});return {data:'  Vera Cruz de Minas  ',error:null};}};
  assert.equal(await Acesso.consultarNome(sb,'invalido'),null);assert.equal(calls.length,0);
  assert.equal(await Acesso.consultarNome(sb,token),'Vera Cruz de Minas');assert.equal(calls.length,1);assert.equal(calls[0].name,'get_workspace_invite_name');assert.equal(calls[0].args.invite_token,token);
});

test('a tela mostra o nome real da congregação antes do login e mantém o link intacto',async()=>{
  const {c,$}=setup({connected:false});c.Conta.supabase=async()=>({rpc:async()=>({data:'Vera Cruz de Minas',error:null})});
  c.mostrarConvite();await c.carregarNomeConvite();assert.equal($('conviteTitulo').textContent,'Vera Cruz de Minas');assert.match($('conviteDescricao').textContent,/convite para acessar a congregação Vera Cruz de Minas/);assert(c.location.search.includes(token));assert.equal(c.user,null);
});

test('falha ao consultar nome permite tentar de novo e sucesso mantém a congregação na confirmação',async()=>{
  const {c,$}=setup();let fail=true;c.Conta.supabase=async()=>({rpc:async name=>name==='accept_workspace_invite'?{data:'w',error:null}:fail?{error:{message:'servidor indisponível'}}:{data:'Vera Cruz de Minas',error:null}});
  c.mostrarConvite();await c.carregarNomeConvite();assert.equal($('conviteRecarregar').hidden,false);assert(c.location.search.includes(token));assert.equal($('conviteAcao').disabled,false);
  fail=false;await c.carregarNomeConvite();assert.equal($('conviteRecarregar').hidden,true);await c.acaoConvite($('conviteAcao'));assert.equal($('conviteTitulo').textContent,'Convite aceito.');assert($('conviteDescricao').textContent.includes('Vera Cruz de Minas'));
});

test('migration de prévia só retorna o nome para convites válidos, sem expor integrantes',()=>{
  const sql=fs.readFileSync('migrations/20261125_03_convite_nome_congregacao.sql','utf8');assert(sql.includes('select w.name'));assert(sql.includes('i.token=invite_token'));assert(sql.includes('i.expires_at>now()'));assert(sql.includes('i.accepted_at is null'));assert(sql.includes('to anon,authenticated'));assert(!sql.includes('workspace_members'));assert(!sql.includes('grant select'));
});
