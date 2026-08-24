// Compartilhamento seguro de uma área de trabalho entre contas Google.
async function initializeWorkspace(){
  const saved=localStorage.getItem('oradores_workspace');
  if(saved){
    const{data}=await supabase.from('workspace_members').select('workspace_id').eq('workspace_id',saved).eq('user_id',currentUser.id).maybeSingle();
    if(data){activeWorkspaceId=saved;return;}
  }
  const{data,error}=await supabase.rpc('ensure_personal_workspace');
  if(error)throw new Error('Atualize o banco executando o novo supabase.sql: '+error.message);
  activeWorkspaceId=data;localStorage.setItem('oradores_workspace',data);
}

async function checkTeamInvite(){
  const token=new URLSearchParams(location.search).get('equipe');if(!token)return;
  const{data,error}=await supabase.rpc('accept_workspace_invite',{invite_token:token});
  if(error)throw new Error('Não foi possível aceitar o convite: '+error.message);
  activeWorkspaceId=data;localStorage.setItem('oradores_workspace',data);
  history.replaceState({},'',location.pathname+location.hash);
  toast('Convite aceito. Agora vocês compartilham o mesmo sistema.',5000);
}

async function createTeamInvite(){
  if(!activeWorkspaceId)return toast('Equipe ainda não carregada.');
  try{
    const{data,error}=await supabase.rpc('create_workspace_invite',{target_workspace:activeWorkspaceId});if(error)throw error;
    const url=location.origin+location.pathname+'?equipe='+encodeURIComponent(data);
    const share={title:'Convite para Oradores',text:'Entre com sua conta Google para acessar a programação compartilhada:',url};
    if(navigator.share)await navigator.share(share);
    else{await navigator.clipboard.writeText(url);toast('Link copiado. Ele dura 24 horas e tem uso único.',5000);}
  }catch(error){if(error.name!=='AbortError')toast('Erro ao criar convite: '+error.message,5000);}
}

async function renderTeamPanel(){
  const el=document.getElementById('teamStatus');if(!el||!activeWorkspaceId)return;
  const{data,error}=await supabase.rpc('list_workspace_members',{target_workspace:activeWorkspaceId});
  if(error){el.textContent='Não foi possível consultar a equipe.';return;}
  el.innerHTML='';
  (data||[]).forEach(member=>{
    const row=document.createElement('div');row.className='team-member';
    const info=document.createElement('span');info.textContent=(member.email||'Conta Google')+(member.user_id===currentUser.id?' (você)':'');row.appendChild(info);
    const role=document.createElement('small');role.textContent=member.role==='owner'?'Proprietário':'Editor';row.appendChild(role);
    if(member.role!=='owner'&&(data||[]).some(x=>x.user_id===currentUser.id&&x.role==='owner')){
      const remove=document.createElement('button');remove.className='btn bo bs';remove.textContent='Remover';remove.onclick=()=>removeTeamMember(member.user_id,member.email);row.appendChild(remove);
    }
    el.appendChild(row);
  });
}

async function removeTeamMember(userId,email){
  if(!confirm('Remover o acesso de '+email+'?'))return;
  const{error}=await supabase.rpc('remove_workspace_member',{target_workspace:activeWorkspaceId,target_user:userId});
  if(error)return toast('Erro ao remover: '+error.message,5000);
  toast('Acesso removido.');renderTeamPanel();
}

function abrirMsgGrupo(jsonOrEnc){
  let sem;try{sem=JSON.parse(jsonOrEnc);}catch(error){sem=JSON.parse(decodeURIComponent(jsonOrEnc));}
  const template=cfg.groupMsg||'Próximo discurso público:\n\nOrador: {orador}\nTema: {tema}\nData: {data}\nCongregação: {minha_cong}';
  window.open('https://wa.me/?text='+encodeURIComponent(buildMsg(template,sem)),'_blank','noopener');
}
