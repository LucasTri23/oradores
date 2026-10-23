// Compartilhamento seguro de uma área de trabalho entre contas Google.
async function initializeWorkspace(){
  const{data,error}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',currentUser.id).maybeSingle();
  if(error)throw new Error('Não foi possível consultar sua congregação. Tente novamente.');
  activeWorkspaceId=data?.workspace_id||null;
  if(activeWorkspaceId){localStorage.setItem('oradores_workspace',activeWorkspaceId);return true;}
  localStorage.removeItem('oradores_workspace');
  document.getElementById('workspaceWelcome').hidden=false;
  document.getElementById('googleLoginBtn').hidden=true;
  return false;
}

async function criarMinhaCongregacao(){
  const botao=document.getElementById('createWorkspaceBtn');if(botao.disabled)return;
  botao.disabled=true;
  try{
    const{error}=await supabase.rpc('ensure_personal_workspace');if(error)throw error;
    location.reload();
  }catch(error){toast('Não foi possível criar a congregação. Tente novamente.',6000);botao.disabled=false;}
}

async function checkTeamInvite(){
  const token=new URLSearchParams(location.search).get('equipe');if(!token)return;
  const{data,error}=await supabase.rpc('accept_workspace_invite',{invite_token:token});
  if(error){
    history.replaceState({},'',location.pathname+location.hash);
    toast('Não foi possível aceitar o convite: '+error.message,8000);
    return;
  }
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
  const[{data,error},{data:identity}]=await Promise.all([supabase.rpc('list_workspace_members',{target_workspace:activeWorkspaceId}),supabase.rpc('get_workspace_share_identity',{target_workspace:activeWorkspaceId})]);
  if(error){el.textContent='Não foi possível consultar a equipe.';return;}
  el.innerHTML='';
  const eu=(data||[]).find(m=>m.user_id===currentUser.id);
  document.getElementById('createTeamInviteBtn').hidden=eu?.role!=='owner';
  document.getElementById('leaveTeamBtn').hidden=!eu;
  const transferencia=document.getElementById('leaveTeamTransfer');
  transferencia.hidden=eu?.role!=='owner';
  const sucessor=document.getElementById('leaveTeamSuccessor');
  sucessor.replaceChildren(new Option('Selecione o novo proprietário',''));
  (data||[]).filter(m=>m.user_id!==currentUser.id).forEach(m=>sucessor.add(new Option(m.email||'Integrante',m.user_id)));
  if(identity?.[0]?.public_code){const box=document.createElement('div');box.className='team-member';const info=document.createElement('span'),label=document.createElement('small'),code=document.createElement('strong'),copy=document.createElement('button');label.textContent='Código para receber oradores';code.textContent=identity[0].public_code;code.style.display='block';code.style.letterSpacing='2px';info.appendChild(label);info.appendChild(code);copy.className='btn bo bs';copy.textContent='Copiar código';copy.onclick=async()=>{await navigator.clipboard.writeText(identity[0].public_code);toast('Código copiado.');};box.appendChild(info);box.appendChild(copy);el.appendChild(box);}
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

let saindoDaCongregacao=false;
async function sairDaCongregacao(){
  if(saindoDaCongregacao||!activeWorkspaceId)return;
  const proprietario=!document.getElementById('leaveTeamTransfer').hidden;
  const select=document.getElementById('leaveTeamSuccessor');
  if(proprietario&&!select.value)return toast('Escolha outro integrante para assumir como proprietário antes de sair. Se você está sozinho, convide alguém primeiro.',8000);
  const aviso='Você perderá o acesso à programação, aos oradores, ao histórico e às configurações desta congregação. Os dados e o acesso dos outros integrantes serão mantidos. Sua conta continuará existindo, sem criar outra congregação automaticamente. Para voltar, será necessário um novo convite.'+(proprietario?' '+select.selectedOptions[0].textContent+' assumirá como proprietário.':'')+' Deseja realmente sair?';
  saindoDaCongregacao=true;
  const botao=document.getElementById('leaveTeamBtn');
  try{
    if(!(await confirmarModal('Sair da congregação',aviso,'Sair da congregação',true)))return;
    botao.disabled=true;botao.textContent='Saindo…';
    const{error}=await supabase.rpc('leave_workspace',{target_workspace:activeWorkspaceId,successor_user:proprietario?select.value:null});
    if(error)throw error;
    activeWorkspaceId=null;localStorage.removeItem('oradores_workspace');
    location.replace(location.pathname);
  }catch(error){toast('Não foi possível sair da congregação: '+error.message,8000);}
  finally{saindoDaCongregacao=false;botao.disabled=false;botao.textContent='Sair da congregação';}
}

async function removeTeamMember(userId,email){
  if(!(await confirmarModal('Remover acesso','Remover o acesso de '+email+'?','Remover',true)))return;
  const{error}=await supabase.rpc('remove_workspace_member',{target_workspace:activeWorkspaceId,target_user:userId});
  if(error)return toast('Erro ao remover: '+error.message,5000);
  toast('Acesso removido.');renderTeamPanel();
}

async function abrirMsgGrupo(jsonOrEnc){
  let sem;try{sem=JSON.parse(jsonOrEnc);}catch(error){sem=JSON.parse(decodeURIComponent(jsonOrEnc));}
  if(sem.canticoNum&&!sem.cantico&&typeof obterTituloCantico==='function')sem.cantico=await obterTituloCantico(sem.canticoNum);
  const template=cfg.groupMsg||'Próximo discurso público:\n\nOrador: {orador}\nTema: {tema}\nData: {data}\nCongregação: {minha_cong}';
  let texto=buildMsg(template,sem);
  if(sem.canticoNum&&!template.includes('{cantico}'))texto+='\nCântico: '+sem.canticoNum+' — '+(sem.cantico||'Título não carregado');
  window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank','noopener');
}
