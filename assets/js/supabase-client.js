// Serviço de integração com Supabase, persistência e autenticação Google.
async function getPublicConfig(){
  const saved=JSON.parse(localStorage.getItem('bj_supabase')||'null');
  if(saved?.url&&saved?.key)return saved;
  try{
    const response=await fetch('/api/config');
    if(response.ok){const config=await response.json();if(config.url&&config.key)return config;}
  }catch(error){}
  return null;
}

async function loadSupabase(config){
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase=createClient(config.url,config.key);
  const wrapDoc=row=>({id:row.id,data:()=>row.data,exists:true});
  // Quem tem acesso "só ver" não grava nada (o banco também bloqueia).
  const exigirEdicao=()=>{
    if(!window.SOMENTE_LEITURA)return;
    toast('Você tem acesso só para ver. Para editar, peça ao proprietário da congregação.',5000);
    throw new Error('Acesso só para ver');
  };

  FF={
    col:(_,name)=>name,
    doc:(_,collection,id)=>({collection,id}),
    ts:()=>new Date().toISOString(),
    gets:async collection=>{
      const{data,error}=await supabase.from('app_records').select('id,data').eq('workspace_id',activeWorkspaceId).eq('collection',collection);
      if(error)throw error;
      return{docs:(data||[]).map(wrapDoc)};
    },
    get:async ref=>{
      const{data,error}=await supabase.from('app_records').select('id,data').eq('workspace_id',activeWorkspaceId).eq('collection',ref.collection).eq('id',ref.id).maybeSingle();
      if(error)throw error;
      return data?wrapDoc(data):{exists:false,data:()=>null};
    },
    add:async(collection,payload)=>{
      exigirEdicao();
      const{data,error}=await supabase.from('app_records').insert({workspace_id:activeWorkspaceId,collection,data:payload}).select('id').single();
      if(error)throw error;
      return{id:data.id};
    },
    set:async(ref,payload)=>{
      exigirEdicao();
      const{error}=await supabase.from('app_records').upsert(
        {id:ref.id,workspace_id:activeWorkspaceId,collection:ref.collection,data:payload,owner_id:currentUser.id},
        {onConflict:'workspace_id,collection,id'}
      );
      if(error)throw error;
    },
    upd:async(ref,patch)=>{
      const old=await FF.get(ref);
      if(!old.exists)throw new Error('Registro não encontrado');
      await FF.set(ref,{...old.data(),...patch});
    },
    del:async ref=>{
      exigirEdicao();
      const{error}=await supabase.from('app_records').delete().eq('workspace_id',activeWorkspaceId).eq('collection',ref.collection).eq('id',ref.id);
      if(error)throw error;
    }
  };
  db={provider:'supabase'};
}

async function checkSetup(){
  renderHome();renderTemas();renderMensagens();updateThemeButton();
  if(window.DesignaUI)DesignaUI.registrarApp();
  const config=await getPublicConfig();
  if(!config){mostrarTelaLogin(false);return showSetupError('O acesso ainda não foi configurado. Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel.');}
  try{
    await loadSupabase(config);
    const{data}=await supabase.auth.getSession();
    if(!data.session){
      // O login fica num lugar só: a tela inicial do Designa, que depois volta para cá.
      const convite=new URLSearchParams(location.search).get('equipe');
      location.replace('/?voltar=/oradores'+(convite?'&equipe='+encodeURIComponent(convite):''));
      return;
    }
    currentUser=data.session.user;
    await checkTeamInvite();
    if(!(await initializeWorkspace())){mostrarTelaLogin(false);return;}
    if(!aplicarAcessoDesigna())return;
    updateUserHeader();
    await loadAll();
    document.getElementById('setup').style.display='none';
    perguntarDiaReuniao2027();
    await renderTeamPanel();
    await checkSharedImport();
  }catch(error){mostrarTelaLogin(true);showSetupError(error.message);}
}

// Troca o "Carregando…" pela tela de entrada (só quando realmente precisa de uma ação da pessoa).
function mostrarTelaLogin(comBotao){
  document.getElementById('setupCarregando').style.display='none';
  document.getElementById('setupHint').hidden=!comBotao;
  document.getElementById('googleLoginBtn').hidden=!comBotao;
}

// Permissões do Designa: sem acesso ao Oradores volta para o início; "só ver" mostra aviso e bloqueia gravações.
function aplicarAcessoDesigna(){
  if(!window.Conta||!membroAtual)return true;
  Conta.usarCliente(supabase);
  const acesso=Conta.acessoDe(membroAtual);
  const vinc={workspaceId:activeWorkspaceId,role:membroAtual.role,...acesso};
  if(!Conta.podeVer(vinc,'oradores')){location.replace('/');return false;}
  DesignaUI.montarSeletor(document.getElementById('dzSwitch'),vinc,'oradores');
  window.SOMENTE_LEITURA=!Conta.podeEditar(vinc,'oradores');
  if(window.SOMENTE_LEITURA){
    document.body.classList.add('somente-leitura');
    const aviso=document.createElement('div');aviso.className='dz-readonly';
    aviso.innerHTML='<i data-lucide="eye"></i><span>Você tem acesso <strong>só para ver</strong> o Oradores. Para editar, peça ao proprietário da congregação.</span>';
    document.querySelector('main')?.prepend(aviso);
    if(window.lucide)lucide.createIcons();
  }
  return true;
}

function showSetupError(message){
  const error=document.getElementById('setupErr');
  error.textContent=message;error.style.display='block';
}

async function doSetup(){
  try{
    if(!supabase){const config=await getPublicConfig();if(!config)throw new Error('Supabase não configurado na Vercel.');await loadSupabase(config);}
    const redirectTo=location.origin+location.pathname+location.search;
    const{error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
    if(error)throw error;
  }catch(error){showSetupError('Não foi possível entrar: '+error.message);}
}

async function logout(){
  if(supabase)await supabase.auth.signOut();
  currentUser=null;activeWorkspaceId=null;localStorage.removeItem('oradores_workspace');
  document.getElementById('workspaceWelcome').hidden=true;
  document.getElementById('setup').style.display='flex';
  location.replace('/');
}
