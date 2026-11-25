(function(root){
  const dias=['DOMINGO','SEGUNDA-FEIRA','TERÇA-FEIRA','QUARTA-FEIRA','QUINTA-FEIRA','SEXTA-FEIRA','SÁBADO'];
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
    const grade=el('div','campo-board');grade.setAttribute('aria-label','Saídas por dia da semana');grade.tabIndex=0;
    const lista=o.lista.filter(c=>!ocultos.includes(new Date(c.data+'T12:00:00').getDay())).slice().sort((a,b)=>a.data.localeCompare(b.data)||String(a.hora).localeCompare(String(b.hora)));
    colunas.forEach(coluna=>{
      const colunaEl=el('section','campo-column'),head=el('div','campo-column-head');head.append(el('h2','',dias[coluna.dia]),el('small','',coluna.itens.length+' saídas no mês'));
      if(o.pode)head.appendChild(botao('Ocultar',()=>alterarDia(coluna.dia,true,o),'campo-hide'));colunaEl.appendChild(head);
      [...new Set(coluna.itens.map(c=>c.data))].forEach(data=>{
      const itens=lista.filter(c=>c.data===data),date=new Date(data+'T12:00:00');
      const card=el('article','reuniao'+(data<o.hoje?' passada':'')+(!o.pode?' leitura':''));
      const topo=el('div','reuniao-topo'),dia=el('div','dia'),tx=el('div','tx');
      dia.append(el('b','',data.slice(8,10)),el('small','',date.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')));
      tx.append(el('strong','',dias[date.getDay()]),el('span','',itens.length+' saídas'+(data===o.hoje?' · Hoje':'')));
      topo.append(dia,tx);card.appendChild(topo);
      itens.forEach(c=>{
        const row=el(o.pode?'button':'div','campo-linha'),info=el('div','campo-info');
        if(o.pode){row.type='button';row.onclick=()=>o.abrir(c.id);row.setAttribute('aria-label','Editar saída de '+data+' às '+c.hora);}
        info.append(el('strong','',c.hora||'Horário a definir'),el('span','',o.local(c.localId)));
        if(c.grupoId)info.appendChild(el('small','','Campo de grupo · '+(c.grupoNome||'Grupo')));
        row.append(info,el('span','nome'+(!c.dirigente&&!c.semSaida?' vago':''),c.semSaida?'Sem saída':c.dirigente?o.nome(c.dirigente):'Escolher dirigente'));
        const avisos=c.dirigente&&!c.semSaida?o.conflitos(c):[];
        if(avisos.length){row.title=avisos.join(' · ');row.appendChild(el('small','campo-slot-warning',avisos.join(' · ')));}
        if(c.recorrente)info.appendChild(el('small','','Recorrente no mês'));
        card.appendChild(row);
      });colunaEl.appendChild(card);
      });
      if(!coluna.itens.length)colunaEl.appendChild(el('p','campo-empty','Nenhuma saída neste mês.'));
      if(o.pode)colunaEl.appendChild(botao('+ Adicionar saída',()=>adicionar(coluna.dia,o),'dz-btn campo-add'));grade.appendChild(colunaEl);
    });
    if(!lista.length)grade.appendChild(el('p','campo-empty','Nenhuma saída visível neste mês. Confira os dias ocultos ou cadastre horários em Locais e dias.'));
    pai.appendChild(grade);
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
