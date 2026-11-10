// Entrada própria do Quadro: autenticação compartilhada, sem inicializar o módulo Oradores.
let supabase=null,activeWorkspaceId=null,cfg={},oradores=[],programa=[],discursos=[],TL={...TEMAS};
const toast=(texto,tempo)=>DesignaUI.toast(texto,tempo);
const isoLocal=Regras.iso;
const fD=data=>data?data.slice(8,10)+'/'+data.slice(5,7)+'/'+data.slice(0,4):'—';
function allMeetingDays(ano){
  const datas=[];for(let mes=1;mes<=12;mes++)datas.push(...Regras.reunioesDoMes(ano,mes,{oradores:cfg}).filter(r=>r.tipo==='fim').map(r=>r.data));return datas;
}
function completarDadosPrograma(r){
  const o=oradores.find(o=>Regras.normalizar(o.nome)===Regras.normalizar(r.nome));
  return {...r,congregacao:r.congregacao||o?.cong||''};
}
let carregandoQuadro=false;
async function iniciarQuadro(){
  if(carregandoQuadro)return;carregandoQuadro=true;
  const estado=document.getElementById('quadroEstado'),erro=document.getElementById('quadroErro'),retry=document.getElementById('quadroTentar');
  estado.hidden=false;erro.textContent='Carregando a programação…';retry.hidden=true;
  try{
    DesignaUI.aplicarTema();DesignaUI.registrarApp();
    const user=await Conta.usuario();if(!user){location.replace('/?voltar=/quadro');return;}
    const vinc=await Conta.vinculo(user);if(!vinc){location.replace('/');return;}
    const podeOradores=Conta.podeVer(vinc,'oradores'),podeDesignacoes=Conta.podeVer(vinc,'designacoes');
    if(!podeOradores&&!podeDesignacoes){location.replace('/');return;}
    supabase=await Conta.supabase();activeWorkspaceId=vinc.workspaceId;
    const dados=await QuadroFonte.carregar(supabase,vinc,Conta);
    cfg=dados.cfg;oradores=dados.oradores;programa=dados.programa;discursos=dados.discursos;TL={...TEMAS,...dados.temas};
    window.quadroAcesso=dados.acesso;
    document.title='Quadro de anúncios — '+vinc.nome;
    document.querySelectorAll('.nomeCong').forEach(el=>el.textContent=vinc.nome);
    DesignaUI.montarSeletor(document.getElementById('dzSwitch'),vinc,'quadro');
    DesignaUI.montarConta(document.getElementById('dzConta'),user);
    document.getElementById('quadroLinkOradores').hidden=!podeOradores;
    document.getElementById('quadroLinkDesignacoes').hidden=!podeDesignacoes;
    const select=document.getElementById('quadroConteudo');
    [...select.options].forEach(o=>o.disabled=o.value==='oradores'?!podeOradores:o.value==='indicadores'?!podeDesignacoes:!podeOradores||!podeDesignacoes);
    if(select.selectedOptions[0].disabled)select.value=podeOradores?'oradores':'indicadores';
    responsaveisDesignacoes=null;
    alterarConteudoQuadro(false);
    document.getElementById('quadroApp').hidden=false;estado.hidden=true;
    DesignaUI.desenharIcones();await atualizarPreviaQuadro();
  }catch(error){erro.textContent=error.message||'Não foi possível abrir o quadro. Tente novamente.';retry.hidden=false;}
  finally{carregandoQuadro=false;}
}
window.addEventListener('load',iniciarQuadro);
