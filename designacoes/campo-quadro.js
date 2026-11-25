(function(root){
  const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const ordem=[1,2,3,4,5,6,0];
  const ocultosValidos=valores=>[...new Set((Array.isArray(valores)?valores:[]).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))];
  function agrupar(lista,ocultos=[]){return ordem.filter(d=>!ocultosValidos(ocultos).includes(d)).map(dia=>({dia,itens:lista.filter(c=>new Date(c.data+'T12:00:00').getDay()===dia).sort((a,b)=>a.data.localeCompare(b.data)||String(a.hora).localeCompare(String(b.hora)))}));}
  function el(tag,classe,texto){const e=document.createElement(tag);e.className=classe||'';if(texto!=null)e.textContent=texto;return e;}
  function botao(texto,acao,classe='dz-btn'){const b=el('button',classe,texto);b.type='button';b.onclick=acao;return b;}
  function render(pai,o){
    pai.replaceChildren();const ocultos=ocultosValidos(o.ocultos),colunas=agrupar(o.lista,ocultos);
    const ferramentas=el('div','campo-board-tools'),resumo=el('p','hint');
    const vagas=o.lista.filter(c=>!ocultos.includes(new Date(c.data+'T12:00:00').getDay())&&!c.dirigente&&!c.semSaida&&c.data>=o.hoje).length;
    resumo.textContent=colunas.length+' dias visíveis · '+vagas+' saídas futuras sem dirigente';ferramentas.appendChild(resumo);
    if(ocultos.length){
      const details=el('details','campo-hidden-days'),summary=el('summary','','Dias ocultos ('+ocultos.length+')');details.appendChild(summary);
      details.appendChild(el('p','hint','Ocultar não cancela saídas. Elas continuam no histórico e nos compartilhamentos.'));
      ocultos.forEach(d=>{if(o.pode)details.appendChild(botao('Reativar '+dias[d],()=>alterarDia(d,false,o)));else details.appendChild(el('span','campo-day-label',dias[d]));});ferramentas.appendChild(details);
    }
    pai.appendChild(ferramentas);
    const atalhos=el('nav','campo-day-nav');atalhos.setAttribute('aria-label','Ir para um dia da semana');
    const grade=el('div','campo-board');
    colunas.forEach(({dia,itens})=>{
      const coluna=el('section','campo-column');coluna.id='campo-dia-'+dia;
      const topo=el('div','campo-column-head'),titulo=el('h2','',dias[dia]);
      topo.append(titulo,el('small','',itens.length+' saídas no mês'));
      if(o.pode){const ocultar=botao('Ocultar',()=>alterarDia(dia,true,o),'campo-hide');ocultar.setAttribute('aria-label','Ocultar '+dias[dia]);topo.appendChild(ocultar);}
      coluna.appendChild(topo);
      if(o.pode)coluna.appendChild(botao('+ Adicionar saída',()=>adicionar(dia,o),'dz-btn campo-add'));
      if(!itens.length)coluna.appendChild(el('p','campo-empty',o.pode?'Sem saídas. Adicione um horário para este dia.':'Nenhuma saída neste dia.'));
      let data='';
      itens.forEach(c=>{
        if(c.data!==data){data=c.data;coluna.appendChild(el('h3','campo-date',c.data.slice(8,10)+'/'+c.data.slice(5,7)+(c.data===o.hoje?' · Hoje':'')));}
        const card=el(o.pode?'button':'article','campo-slot'+(c.data<o.hoje?' is-past':'')+(c.semSaida?' is-cancelled':!c.dirigente?' is-open':''));
        if(o.pode){card.type='button';card.onclick=()=>o.abrir(c.id);card.setAttribute('aria-label','Editar saída de '+c.data.slice(8,10)+'/'+c.data.slice(5,7)+' às '+(c.hora||'horário a definir'));}
        card.append(el('strong','campo-slot-time',c.hora||'Horário a definir'),el('span','campo-slot-place',o.local(c.localId)));
        card.appendChild(el('span','campo-slot-person',c.semSaida?'Sem saída':c.dirigente?o.nome(c.dirigente):'+ Escolher dirigente'));
        if(c.recorrente)card.appendChild(el('small','campo-slot-meta','Recorrente no mês'));
        if(c.removida)card.appendChild(el('small','campo-slot-meta','Horário removido da configuração'));
        const avisos=c.dirigente&&!c.semSaida?o.conflitos(c):[];
        if(avisos.length)card.appendChild(el('small','campo-slot-warning',avisos.join(' · ')));
        coluna.appendChild(card);
      });
      grade.appendChild(coluna);atalhos.appendChild(botao(dias[dia].split('-')[0],()=>coluna.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'}),'campo-day-tab'));
    });
    if(!colunas.length)pai.appendChild(el('p','campo-empty','Todos os dias estão ocultos. Use “Dias ocultos” para reativar.'));
    pai.append(atalhos,grade);
  }
  let salvandoDia=false;
  async function alterarDia(dia,ocultar,o){
    if(!o.pode||salvandoDia)return;
    if(ocultar&&!confirm('Ocultar '+dias[dia]+' nesta aba para a congregação? As saídas não serão canceladas. Você pode reativar em Dias ocultos.'))return;
    salvandoDia=true;
    try{await o.salvarDia(dia,ocultar);o.render();o.toast(ocultar?'Dia ocultado. Reative em Dias ocultos.':'Dia reativado.');}catch(e){o.toast('Não foi possível salvar: '+e.message);}finally{salvandoDia=false;}
  }
  function adicionar(dia,o){
    if(!o.pode)return;
    const dialog=el('dialog','campo-add-dialog'),form=el('form');
    const titulo=el('h2','','Adicionar saída · '+dias[dia]);titulo.id='campoAddTitulo';dialog.setAttribute('aria-labelledby',titulo.id);
    form.append(titulo,el('p','hint','Cria um horário semanal para este dia. Depois, toque nas saídas do mês para escolher os dirigentes.'));
    const field=(label,input)=>{const l=el('label','');l.append(el('span','',label),input);form.appendChild(l);return input;};
    const hora=field('Horário',el('input'));hora.type='time';hora.required=true;hora.value='09:00';
    const local=field('Local',el('select'));local.appendChild(new Option('Novo local…','novo'));o.locais.forEach(l=>local.add(new Option(l.nome,l.id)));local.value=o.locais[0]?.id||'novo';
    const novo=field('Nome do novo local',el('input'));novo.maxLength=160;novo.placeholder='Ex.: Salão do Reino';
    const sync=()=>{novo.parentElement.hidden=local.value!=='novo';novo.required=local.value==='novo';};local.onchange=sync;sync();
    const status=el('p','campo-slot-warning');status.setAttribute('role','alert');
    const actions=el('div','campo-add-actions'),cancel=botao('Cancelar',()=>{if(!save.disabled){dialog.close();dialog.remove();}}),save=el('button','dz-btn pri','Adicionar saída');save.type='submit';actions.append(cancel,save);form.append(status,actions);dialog.appendChild(form);
    dialog.addEventListener('cancel',e=>{if(save.disabled)e.preventDefault();else dialog.remove();});
    form.onsubmit=async e=>{
      e.preventDefault();if(save.disabled)return;save.disabled=true;status.textContent='Salvando…';
      try{await o.adicionar({dia,hora:hora.value,localId:local.value==='novo'?'':local.value,novoLocal:local.value==='novo'?novo.value.trim():''});dialog.close();dialog.remove();o.render();o.toast('Saída semanal adicionada. Toque numa data para escolher o dirigente.');}
      catch(error){status.textContent=error.message;save.disabled=false;}
    };
    document.body.appendChild(dialog);dialog.showModal();hora.focus();
  }
  root.CampoQuadro={render,agrupar,ocultosValidos};if(typeof module!=='undefined')module.exports=root.CampoQuadro;
})(typeof window!=='undefined'?window:globalThis);
