const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const QuadroFonte=require('../quadro/fonte.js'),Regras=require('../designacoes/regras.js');

function banco(registros={},falhar=false){
  const consultas=[];
  const sb={from:t=>{assert.equal(t,'app_records');return {select:()=>({eq:(col,ws)=>{assert.equal(col,'workspace_id');assert.equal(ws,'equipe');return {eq:async(_,collection)=>{consultas.push(collection);return {data:registros[collection]||[],error:falhar?{message:'erro'}:null};}};}})};}};
  return {sb,consultas};
}
const conta=(oradores,designacoes)=>({podeVer:(_,m)=>m==='oradores'?oradores:designacoes});
test('quadro de Designações não consulta coleções de Oradores',async()=>{
  const {sb,consultas}=banco();const dados=await QuadroFonte.carregar(sb,{workspaceId:'equipe',nome:'Central'},conta(false,true));
  assert.equal(consultas.length,0);assert.equal(dados.acesso.designacoes,true);assert.equal(dados.cfg.cong,'Central');assert.deepEqual(dados.programa,[]);
});
test('carregamento do quadro usa só leitura, configuração e temas da congregação',async()=>{
  const {sb,consultas}=banco({config:[{id:'app',data:{cong:'Nome antigo',dia:0}},{id:'temas',data:{overrides:{1:'Tema corrigido'}}}],programa:[{id:'semana',data:{data:'2026-11-08',nome:'Orador'}}]});
  const dados=await QuadroFonte.carregar(sb,{workspaceId:'equipe',nome:'Nome atual'},conta(true,false));
  assert.equal(dados.cfg.cong,'Nome atual');assert.equal(dados.cfg.dia,0);assert.equal(dados.temas[1],'Tema corrigido');assert.equal(dados.programa[0].id,'semana');assert.equal(consultas.length,4);
});
test('sem acesso não consulta dados e falhas de leitura são apresentadas',async()=>{
  const b=banco();await assert.rejects(()=>QuadroFonte.carregar(b.sb,{workspaceId:'equipe'},conta(false,false)),/acesso/);assert.equal(b.consultas.length,0);
  await assert.rejects(()=>QuadroFonte.carregar(banco({},true).sb,{workspaceId:'equipe'},conta(true,false)),/carregar/);
});
test('rota independente mantém os controles sem carregar o aplicativo Oradores',()=>{
  const html=fs.readFileSync('quadro/index.html','utf8');
  assert(!html.includes('http-equiv="refresh"'));assert(!html.includes('/oradores#quadro'));
  for(const path of ['/assets/js/app.js','/assets/js/supabase-client.js','/assets/js/features/'])assert(!html.includes(path));
  for(const id of ['quadroConteudo','quadroMes','quadroQuantidade','quadroPreview','quadroCor-principal','quadroBaixar'])assert(html.includes('id="'+id+'"'));
  assert(!fs.readFileSync('oradores/index.html','utf8').includes('id="page-quadro"'));
});

function runtime({sessao=true,oradores=false,designacoes=true}={}){
  const elements={},el=id=>elements[id]??={hidden:true,textContent:'',value:'oradores',options:[{value:'oradores'},{value:'indicadores'},{value:'completo'}],get selectedOptions(){return this.options.filter(o=>o.value===this.value);}};
  const {sb,consultas}=banco(),redirecionamentos=[];
  const c={TEMAS:{},Regras,QuadroFonte,window:{addEventListener(){}},document:{getElementById:el,querySelectorAll:()=>[]},
    location:{replace:u=>redirecionamentos.push(u)},Conta:{usuario:async()=>sessao?{id:'usuario'}:null,vinculo:async()=>({workspaceId:'equipe',nome:'Central'}),supabase:async()=>sb,...conta(oradores,designacoes)},
    DesignaUI:{aplicarTema(){},registrarApp(){},montarSeletor(){},montarConta(){},desenharIcones(){}},responsaveisDesignacoes:null,alterarConteudoQuadro(){},atualizarPreviaQuadro:async()=>{}};
  vm.createContext(c);vm.runInContext(fs.readFileSync('quadro/app.js','utf8'),c);return {c,el,consultas,redirecionamentos};
}
test('inicialização independente atende quem só acessa Designações',async()=>{
  const {c,el,consultas,redirecionamentos}=runtime();await c.iniciarQuadro();
  assert.equal(el('quadroApp').hidden,false);assert.equal(el('quadroConteudo').value,'indicadores');assert.equal(el('quadroLinkOradores').hidden,true);assert.equal(consultas.length,0);assert.equal(redirecionamentos.length,0);
});
test('sem sessão retorna ao login com destino /quadro; sem acesso volta ao Início',async()=>{
  const login=runtime({sessao:false});await login.c.iniciarQuadro();assert.deepEqual(login.redirecionamentos,['/?voltar=/quadro']);
  const sem=runtime({oradores:false,designacoes:false});await sem.c.iniciarQuadro();assert.deepEqual(sem.redirecionamentos,['/']);
});
