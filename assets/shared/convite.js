(function(root){
  const tokenValido=token=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token||'');
  function erroAmigavel(error){
    const msg=String(error?.message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    let texto='Não foi possível confirmar o convite. Verifique sua conexão e tente novamente.',indisponivel=false,sessaoExpirada=false;
    if(/login|entre com google|autentic|jwt|sessao/.test(msg)){texto='Sua sessão expirou. Entre novamente com Google para confirmar o convite.';sessaoExpirada=true;}
    else if(/invalido|expirado|utilizado|ja usado/.test(msg)){texto='Este convite expirou, já foi usado ou não está mais disponível. Peça um novo link ao responsável da congregação.';indisponivel=true;}
    else if(/outra congregacao|outro workspace/.test(msg))texto='Esta conta já está vinculada a outra congregação. Use outra conta Google ou fale com o responsável pelo convite.';
    return Object.assign(new Error(texto),{indisponivel,sessaoExpirada});
  }
  async function aceitar(sb,token){
    if(!tokenValido(token))throw Object.assign(new Error('Este link de convite está incompleto ou é inválido. Peça um novo link ao responsável da congregação.'),{indisponivel:true});
    try{const {data,error}=await sb.rpc('accept_workspace_invite',{invite_token:token});if(error)throw error;return data;}
    catch(error){throw erroAmigavel(error);}
  }
  async function consultarNome(sb,token){
    if(!tokenValido(token))return null;
    try{const {data,error}=await sb.rpc('get_workspace_invite_name',{invite_token:token});if(error)throw error;return typeof data==='string'&&data.trim()?data.trim():null;}
    catch(error){throw new Error('Não foi possível carregar o nome da congregação. Verifique a conexão e tente novamente.');}
  }
  root.ConviteAcesso={tokenValido,erroAmigavel,aceitar,consultarNome};if(typeof module!=='undefined')module.exports=root.ConviteAcesso;
})(typeof window!=='undefined'?window:globalThis);
