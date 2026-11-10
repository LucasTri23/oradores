(function(root){
  const estados=new WeakMap();
  function rastrear(form,botao,status){
    if(estados.has(form))return estados.get(form);
    const e={sujo:false,salvando:false,versao:0,botao,status};estados.set(form,e);
    const mudou=()=>{e.sujo=true;e.versao++;status.textContent='Alterações não salvas';status.dataset.estado='pendente';};
    form.addEventListener('input',mudou);form.addEventListener('change',mudou);e.marcar= mudou;return e;
  }
  async function executar(form,botao,status,acao,opcoes={}){
    const e=rastrear(form,botao,status);if(e.salvando)return false;
    const versao=e.versao,rotulo=botao.innerHTML;e.salvando=true;botao.disabled=true;botao.textContent='Salvando…';form.setAttribute('aria-busy','true');status.textContent='Salvando…';status.dataset.estado='salvando';
    const campos=opcoes.bloquear?[...form.querySelectorAll('input,select,textarea')].map(c=>({c,disabled:c.disabled})):[];campos.forEach(({c})=>c.disabled=true);
    try{
      const resultado=await acao();
      if(resultado===false){status.textContent='Operação não concluída. Revise os dados e tente novamente.';status.dataset.estado='erro';return false;}
      e.sujo=e.versao!==versao;status.textContent=e.sujo?'Salvo. Há novas alterações não salvas.':'Alterações salvas.';status.dataset.estado=e.sujo?'pendente':'salvo';return true;
    }catch(error){status.textContent='Não foi possível salvar. '+(error?.message||'Tente novamente.');status.dataset.estado='erro';return false;}
    finally{campos.forEach(({c,disabled})=>c.disabled=disabled);e.salvando=false;botao.disabled=false;botao.innerHTML=rotulo;form.removeAttribute('aria-busy');}
  }
  function instalar(nome){
    const original=root[nome];if(typeof original!=='function'||original._formUX)return;
    const botoes=[...document.querySelectorAll('[onclick]')].filter(b=>b.getAttribute('onclick')?.trim().startsWith(nome+'('));
    if(!botoes.length)return;
    const bindings=botoes.map(botao=>{
      const form=botao.closest('.modal,.janela,.ccard,.card,.dz-card,.form-card')||botao.parentElement;
      const status=document.createElement('p');status.className='save-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');botao.after(status);rastrear(form,botao,status);return {botao,form,status};
    });
    const wrapped=async function(...args){
      const b=bindings.find(b=>b.form.getClientRects().length)||bindings[0];
      return executar(b.form,b.botao,b.status,async()=>{const r=await original.apply(this,args);return r===true;},{bloquear:true});
    };wrapped._formUX=true;root[nome]=wrapped;
  }
  root.FormUX={rastrear,executar,instalar};
  if(typeof module!=='undefined')module.exports=root.FormUX;
  if(typeof document!=='undefined')root.addEventListener('load',()=>['saveAgend','saveOrador','saveDiscursante','salvarReuniao','salvarPessoa','salvarPessoaCong','salvarEvento','regManual'].forEach(instalar));
})(typeof window!=='undefined'?window:globalThis);
