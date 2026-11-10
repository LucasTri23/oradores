// Montagem pura dos dados do quadro; os nomes e as datas vêm das coleções permitidas.
(function(root){
  function montarMes({data,regras,cfg={},cfgOradores=null,reunioes=[],pessoas=[],programa=[],temas={},incluirDiscursos=true,incluirDesignacoes=true}){
    const R=regras,lista=R.reunioesDoMes(data.getFullYear(),data.getMonth()+1,{...cfg,oradores:cfgOradores},reunioes),q=R.quantidades(cfg);
    const nomes=new Map(pessoas.map(p=>[p.id,p.nome])),nome=id=>nomes.get(id)||'A definir',nomesDe=(r,f)=>R.pessoasDe(r,f).map(nome),ddmm=d=>d.slice(8,10)+'/'+d.slice(5,7);
    const fim=lista.filter(r=>r.tipo==='fim'),meio=lista.filter(r=>r.tipo==='meio');
    const grade=(tipo,rs)=>{
      if(!incluirDesignacoes)return null;
      const funcs=['indicadores','microfones','audio_video'].filter(f=>q[tipo][f]>0);
      if(!funcs.length||!rs.length)return null;
      return {grupos:funcs.map(f=>({titulo:R.FUNCOES[f].nome,vagas:Array.from({length:q[tipo][f]},(_,i)=>R.rotuloVaga(f,i,q[tipo][f]))})),linhas:rs.map(r=>r.semReuniao?{data:ddmm(r.data),mesclado:r.motivo||'Não haverá reunião'}:{data:ddmm(r.data),valores:funcs.flatMap(f=>Array.from({length:q[tipo][f]},(_,i)=>nome(r.pessoas?.[f]?.[i])))})};
    };
    const discursos=incluirDiscursos?fim.map(r=>{
      const p=programa.find(p=>p.data===r.data)||{};
      if(r.semReuniao||p.semDiscurso)return {data:ddmm(r.data),mesclado:r.motivo||p.motivo||'Sem discurso'};
      return {data:ddmm(r.data),nome:p.nome||'A definir',cong:p.congregacao||'',tema:p.especial?(p.tema||p.especialTitulo||'Discurso especial'):(temas[p.temaNum]||p.tema||'A definir')};
    }):null;
    const presidencia=incluirDesignacoes&&(q.fim.presidente||q.fim.leitor)?fim.map(r=>r.semReuniao?{data:ddmm(r.data),mesclado:r.motivo||'Não haverá reunião'}:{data:ddmm(r.data),presidente:nomesDe(r,'presidente').join(' / '),leitor:nomesDe(r,'leitor').join(' / ')}):null;
    let zoom=null;
    if(incluirDesignacoes&&(q.meio.zoom||q.fim.zoom)){
      const semanas=new Map();lista.filter(r=>q[r.tipo].zoom>0).forEach(r=>{const chave=R.segundaDaSemana(r.data);if(!semanas.has(chave))semanas.set(chave,[]);semanas.get(chave).push(r);});
      zoom=[...semanas.values()].map(rs=>({rotulo:rs.length>1?rs.slice(0,-1).map(r=>r.data.slice(8,10)).join(', ')+' e '+ddmm(rs.at(-1).data):ddmm(rs[0].data),nomes:[...new Set(rs.filter(r=>!r.semReuniao).flatMap(r=>nomesDe(r,'zoom')))].join(' / ')}));
    }
    const reunioesPdf=lista.map(r=>({...r,linhas:r.semReuniao?[]:R.FUNCOES_POR_TIPO[r.tipo].filter(f=>q[r.tipo][f]>0).map(f=>({funcao:R.FUNCOES[f].nome,nomes:Array.from({length:q[r.tipo][f]},(_,i)=>nome(r.pessoas?.[f]?.[i]))}))}));
    return {data,discursos,presidencia,fim:grade('fim',fim),meio:grade('meio',meio),zoom,reunioes:reunioesPdf};
  }
  root.QuadroDados={montarMes};
  if(typeof module!=='undefined')module.exports=root.QuadroDados;
})(typeof window!=='undefined'?window:globalThis);
