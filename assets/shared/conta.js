// Login, congregação e permissões compartilhados entre a tela inicial e os módulos.
// O nome do sistema fica só aqui: troque APP_NOME se quiser mudar o nome.
window.APP_NOME='Designa';

window.Conta=(function(){
  const MODULOS={
    oradores:{nome:'Oradores',caminho:'/oradores',descricao:'Programação de discursos, oradores, histórico e quadro de anúncios.'},
    territorios:{nome:'Territórios',caminho:'/territorios',descricao:'Registro de territórios, cartões de mapa, dirigentes e campanhas.'}
  };
  let cliente=null;

  async function config(){
    try{const salvo=JSON.parse(localStorage.getItem('bj_supabase')||'null');if(salvo?.url&&salvo?.key)return salvo;}catch(e){}
    try{const r=await fetch('/api/config');if(r.ok){const c=await r.json();if(c.url&&c.key)return c;}}catch(e){}
    return null;
  }

  async function supabase(){
    if(cliente)return cliente;
    const c=await config();
    if(!c)throw new Error('O acesso ainda não foi configurado. Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel.');
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    cliente=createClient(c.url,c.key);
    return cliente;
  }

  async function usuario(){
    const sb=await supabase();
    const {data}=await sb.auth.getSession();
    return data.session?.user||null;
  }

  async function entrar(redirectTo){
    const sb=await supabase();
    const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectTo||location.href,queryParams:{prompt:'select_account'}}});
    if(error)throw error;
  }

  async function sair(){
    const sb=await supabase();
    await sb.auth.signOut();
    try{localStorage.removeItem('oradores_workspace');}catch(e){}
  }

  // Vínculo da conta com a congregação: {workspaceId, role, modulos, nome} ou null.
  async function vinculo(user){
    const sb=await supabase();
    const {data,error}=await sb.from('workspace_members').select('workspace_id,role,modules').eq('user_id',user.id).maybeSingle();
    if(error)throw new Error('Não foi possível consultar sua congregação. Se o banco ainda não foi atualizado, execute o supabase.sql novamente.');
    if(!data)return null;
    const {data:ws}=await sb.from('workspaces').select('name').eq('id',data.workspace_id).maybeSingle();
    const modulos=data.role==='owner'?Object.keys(MODULOS):(Array.isArray(data.modules)?data.modules:['oradores']);
    try{localStorage.setItem('oradores_workspace',data.workspace_id);}catch(e){}
    return {workspaceId:data.workspace_id,role:data.role,modulos,nome:ws?.name||'Minha Congregação'};
  }

  return {MODULOS,supabase,usuario,entrar,sair,vinculo};
})();
