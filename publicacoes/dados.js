(function(root){
  function criar(sb,vinc,user,conta){
    const editar=()=>{if(!conta.podeEditar(vinc,'publicacoes'))throw new Error('Você tem acesso somente para consultar Publicações.');};
    async function listar(colecao){
      if(!conta.podeVer(vinc,'publicacoes'))throw new Error('Sem acesso a Publicações.');
      const {data,error}=await sb.from('app_records').select('id,data').eq('workspace_id',vinc.workspaceId).eq('collection',colecao);if(error)throw new Error('Não foi possível carregar Publicações. Confira a conexão e a atualização SQL.');return (data||[]).map(r=>({...r.data,id:r.id}));
    }
    async function pedido(p){editar();const validado=PublicacoesRegras.validarPedido(p);const{id,revision=0,...payload}=validado;
      const {data,error}=await sb.rpc('save_publication_order',{target_workspace:vinc.workspaceId,order_id:id,expected_revision:revision,payload});
      if(error)throw new Error(error.message?.includes('alterado por outra pessoa')?'Este pedido foi alterado por outra pessoa. Feche os detalhes, atualize a lista e tente novamente.':'O pedido não foi salvo. Verifique a conexão, suas permissões e a atualização SQL.');return {...validado,revision:data};
    }
    async function importar(relatorio,arquivo,expectedRevision){editar();const itens=PublicacoesRegras.validarItens(relatorio.itens);
      const caminho=vinc.workspaceId+'/'+relatorio.mes+'/'+crypto.randomUUID()+'.pdf';
      const upload=await sb.storage.from('publicacoes').upload(caminho,arquivo,{contentType:'application/pdf',upsert:false});if(upload.error)throw new Error('O PDF não foi anexado. Verifique sua conexão e se o SQL do módulo foi aplicado.');
      const {data,error}=await sb.rpc('save_publication_inventory',{target_workspace:vinc.workspaceId,reference_month:relatorio.mes,expected_revision:expectedRevision,payload:{itens,arquivo:caminho,nomeArquivo:arquivo.name,importadoEm:new Date().toISOString(),importadoPor:user.email||user.id}});
      if(error){
        // Em falhas de rede, a gravação pode ter sido concluída. Não apague o PDF nesse caso.
        if(error.code&&/^(P|22|23|42)/.test(error.code))await sb.storage.from('publicacoes').remove([caminho]);
        throw new Error(error.message?.includes('alterado por outra pessoa')?'O relatório deste mês mudou durante a conferência. Reabra a importação e confira novamente.':'Não foi possível confirmar a importação. Atualize a lista de relatórios antes de tentar novamente.');
      }return data;
    }
    async function abrirPdf(caminho){const {data,error}=await sb.storage.from('publicacoes').createSignedUrl(caminho,300);if(error)throw new Error('Não foi possível abrir o PDF.');return data.signedUrl;}
    return {listar,pedido,importar,abrirPdf};
  }
  root.PublicacoesDados={criar};if(typeof module!=='undefined')module.exports=root.PublicacoesDados;
})(typeof window!=='undefined'?window:globalThis);
