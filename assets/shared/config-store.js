(function(root){
  function criar(sb,vinc,user,conta){
    const modulo=col=>col==='desig_config'?'designacoes':col.startsWith('terr_')?'territorios':'oradores';
    async function ler(col,id){
      if(!conta.podeVer(vinc,modulo(col)))return {};
      const{data,error}=await sb.from('app_records').select('data').eq('workspace_id',vinc.workspaceId).eq('collection',col).eq('id',id).maybeSingle();
      if(error)throw new Error('Não foi possível carregar as preferências. Tente novamente.');return data?.data||{};
    }
    async function salvar(col,id,patch){
      if(!conta.podeEditar(vinc,modulo(col)))throw new Error('Sua conta não pode editar estas preferências.');
      const atual=await ler(col,id),data={...atual,...patch};
      const{error}=await sb.from('app_records').upsert({id,workspace_id:vinc.workspaceId,owner_id:user.id,collection:col,data},{onConflict:'workspace_id,collection,id'});
      if(error)throw new Error('A gravação não foi concluída. Verifique sua conexão e tente novamente.');return data;
    }
    return {ler,salvar};
  }
  root.ConfigStore={criar};if(typeof module!=='undefined')module.exports=root.ConfigStore;
})(typeof window!=='undefined'?window:globalThis);
