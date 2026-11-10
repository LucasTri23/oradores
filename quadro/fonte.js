(function(root){
  async function carregar(sb,vinc,conta){
    const acesso={oradores:conta.podeVer(vinc,'oradores'),designacoes:conta.podeVer(vinc,'designacoes')};
    if(!acesso.oradores&&!acesso.designacoes)throw new Error('Sua conta não tem acesso às programações do quadro.');
    const ler=async collection=>{
      const{data,error}=await sb.from('app_records').select('id,data').eq('workspace_id',vinc.workspaceId).eq('collection',collection);
      if(error)throw new Error('Não foi possível carregar a programação. Tente novamente.');
      return (data||[]).map(r=>({...r.data,id:r.id}));
    };
    let oradores=[],programa=[],discursos=[],config=[];
    if(acesso.oradores)[oradores,programa,discursos,config]=await Promise.all(['oradores','programa','discursos','config'].map(ler));
    const cfg={dia:6,dia2027:null,...(config.find(r=>r.id==='app')||{}),cong:vinc.nome};
    return {acesso,cfg,oradores,programa,discursos,temas:config.find(r=>r.id==='temas')?.overrides||{}};
  }
  root.QuadroFonte={carregar};if(typeof module!=='undefined')module.exports=root.QuadroFonte;
})(typeof window!=='undefined'?window:globalThis);
