(function(root){
  let montado=null,sequencia=0;
  const el=(tag,classe,texto)=>{const n=document.createElement(tag);if(classe)n.className=classe;if(texto)n.textContent=texto;return n;};
  function campo(pai,titulo,valor,tipo='text',opcoes){
    const box=el('div','native-field'),label=el('label','',titulo),input=el(opcoes?'select':tipo==='textarea'?'textarea':'input');
    input.id='preferencia-'+(++sequencia);label.htmlFor=input.id;
    if(opcoes)opcoes.forEach(([v,t])=>input.add(new Option(t,String(v))));else if(tipo!=='textarea')input.type=tipo;
    if(tipo==='checkbox')input.checked=!!valor;else input.value=valor??'';
    if(tipo==='textarea')input.rows=4;box.append(label,input);pai.appendChild(box);return input;
  }
  function formulario(pai,titulo,pode,gravar){
    const form=el('form','dz-card native-form'),heading=el('h2','',titulo),body=el('fieldset'),footer=el('div','save-bar'),button=el('button','dz-btn pri','Salvar alterações'),status=el('p','save-status');
    body.disabled=!pode;button.type='submit';button.hidden=!pode;status.setAttribute('role','status');status.setAttribute('aria-live','polite');footer.append(button,status);form.append(heading,body,footer);pai.appendChild(form);
    FormUX.rastrear(form,button,status);form.addEventListener('submit',e=>{e.preventDefault();FormUX.executar(form,button,status,()=>gravar());});return {form,body,button,status};
  }
  async function montar({container,vinc,user}){
    if(montado===vinc.workspaceId)return;
    container.textContent='Carregando preferências…';
    try{
      const sb=await Conta.supabase(),store=ConfigStore.criar(sb,vinc,user,Conta),ver=m=>Conta.podeVer(vinc,m),editar=m=>Conta.podeEditar(vinc,m);
      const [o,d]=await Promise.all([store.ler('config','app'),store.ler('desig_config','app')]);
      const extras=ver('territorios')?await Promise.all(['contatos','mensagens','campanhas'].map(id=>store.ler('terr_tj_config',id))):[];
      const mensagens=ver('oradores')?await store.ler('config','mensagens'):{};
      container.replaceChildren();const nav=el('nav','config-tabs');nav.setAttribute('aria-label','Seções das configurações');container.appendChild(nav);
      const paineis={},botoes={};
      for(const [key,nome] of [['congregacao','Congregação'],['reunioes','Reuniões'],['funcoes','Funções'],['equipe','Equipe'],['preferencias','Mensagens e territórios']]){
        const painel=el('section','config-panel'),b=el('button','dz-btn',nome);painel.id='preferencias-'+key;b.type='button';b.setAttribute('aria-controls',painel.id);b.onclick=()=>abrir(key);botoes[key]=b;paineis[key]=painel;nav.appendChild(b);container.appendChild(painel);
      }
      function abrir(key){Object.entries(paineis).forEach(([k,p])=>{p.hidden=k!==key;botoes[k].setAttribute('aria-pressed',String(k===key));});}
      for(const [id,key] of [['configNomeCard','congregacao'],['configInstalarCard','congregacao'],['configAcessoCard','equipe'],['painelDono','equipe']]){const card=document.getElementById(id);if(card)paineis[key].appendChild(card);}
      const nomeCard=document.getElementById('configNomeCard'),nomeBtn=document.getElementById('cfgNomeBtn'),nomeStatus=el('p','save-status');nomeStatus.id='cfgNomeStatus';nomeStatus.setAttribute('role','status');nomeCard.appendChild(nomeStatus);FormUX.rastrear(nomeCard,nomeBtn,nomeStatus);
      if(ver('oradores')){
        let endereco,horario,dia,dia2027,sentinela;
        const f=formulario(paineis.reunioes,'Discursos públicos',editar('oradores'),()=>store.salvar('config','app',{end:endereco.value.trim(),hor:horario.value,dia:Number(dia.value),dia2027:dia2027.value===''?null:Number(dia2027.value),sugerirSentinela:sentinela.checked}));
        endereco=campo(f.body,'Endereço da reunião',o.end||'');horario=campo(f.body,'Horário',o.hor||'19:00','time');dia=campo(f.body,'Dia do fim de semana',o.dia??6,'select',[[6,'Sábado'],[0,'Domingo']]);dia2027=campo(f.body,'Dia do fim de semana em 2027',o.dia2027??'','select',[['','Usar o padrão'],[6,'Sábado'],[0,'Domingo']]);sentinela=campo(f.body,'Sugerir discursos relacionados à Sentinela',o.sugerirSentinela,'checkbox');
        let grupo;const g=formulario(paineis.preferencias,'Mensagem do grupo — Oradores',editar('oradores'),()=>store.salvar('config','app',{groupMsg:grupo.value.trim()}));grupo=campo(g.body,'Modelo da mensagem (variáveis como {orador}, {tema} e {data})',o.groupMsg||'','textarea');
        listaEditavel(paineis.preferencias,'Mensagens para oradores',mensagens.lista||[],[['titulo','Título'],['tipo','Tipo (convite ou geral)'],['texto','Mensagem','textarea']],editar('oradores'),lista=>store.salvar('config','mensagens',{lista}));
      }
      if(ver('designacoes')){
        let meio,fim;
        const r=formulario(paineis.reunioes,'Datas das Designações',editar('designacoes'),()=>store.salvar('desig_config','app',{diaMeio:meio.value===''?null:Number(meio.value),...(!ver('oradores')?{diaFim:Number(fim.value)}:{})}));
        meio=campo(r.body,'Reunião do meio de semana',d.diaMeio??'','select',[['','Ainda não definido'],...[1,2,3,4,5].map(n=>[n,Regras.DIAS[n]])]);
        if(!ver('oradores'))fim=campo(r.body,'Reunião do fim de semana',d.diaFim??6,'select',[[6,'Sábado'],[0,'Domingo']]);
        else r.body.appendChild(el('p','hint','O fim de semana segue os dias definidos em Discursos públicos, acima.'));
        const inputs=[];let zoom;
        const f=formulario(paineis.funcoes,'Pessoas por função',editar('designacoes'),()=>{
          const quantidades={meio:{},fim:{}};inputs.forEach(i=>{const v=Number(i.value);if(!Number.isInteger(v)||v<0||v>6)throw new Error('Use números inteiros de 0 a 6.');quantidades[i.dataset.tipo][i.dataset.funcao]=v;});
          return store.salvar('desig_config','app',{quantidades,zoomSemanal:zoom.checked});
        });f.body.appendChild(el('p','hint','Use 0 quando a função não for usada. Desmarcar Usar zera as duas reuniões.'));
        const table=el('table','native-quantidades'),head=el('thead');head.innerHTML='<tr><th scope="col">Usar</th><th scope="col">Função</th><th scope="col">Meio de semana</th><th scope="col">Fim de semana</th></tr>';const tbody=el('tbody');table.append(head,tbody);const wrap=el('div','table-scroll');wrap.appendChild(table);f.body.appendChild(wrap);
        const q=Regras.quantidades(d);
        Object.entries(Regras.FUNCOES).forEach(([key,funcao])=>{
          const tr=el('tr'),td=el('td'),usar=el('input');usar.type='checkbox';usar.checked=(q.meio[key]||0)+(q.fim[key]||0)>0;usar.setAttribute('aria-label','Usar '+funcao.nome);td.appendChild(usar);tr.append(td,el('th','',funcao.nome));const campos=[];
          ['meio','fim'].forEach(tipo=>{const c=el('td');if(Regras.FUNCOES_POR_TIPO[tipo].includes(key)){const i=el('input');i.type='number';i.min=0;i.max=6;i.value=q[tipo][key];i.dataset.tipo=tipo;i.dataset.funcao=key;i.disabled=!usar.checked;i.setAttribute('aria-label',funcao.nome+' — '+(tipo==='meio'?'meio de semana':'fim de semana'));campos.push(i);inputs.push(i);c.appendChild(i);}else c.textContent='—';tr.appendChild(c);});
          usar.onchange=()=>campos.forEach(i=>{i.disabled=!usar.checked;i.value=usar.checked?(Regras.QTD_PADRAO[i.dataset.tipo][key]||1):0;});tbody.appendChild(tr);
        });zoom=campo(f.body,'Zoom semanal: a mesma pessoa nas duas reuniões',Regras.zoomSemanal(d),'checkbox');
      }else{botoes.funcoes.hidden=true;}
      if(ver('territorios')){
        listaEditavel(paineis.preferencias,'Dirigentes — Territórios',extras[0].lista||[],[['nome','Nome'],['num','WhatsApp com país e DDD']],editar('territorios'),lista=>store.salvar('terr_tj_config','contatos',{lista,updatedAt:new Date().toISOString()}));
        listaEditavel(paineis.preferencias,'Mensagens — Territórios',extras[1].lista||[],[['label','Título'],['texto','Mensagem','textarea']],editar('territorios'),lista=>store.salvar('terr_tj_config','mensagens',{lista,updatedAt:new Date().toISOString()}));
        listaEditavel(paineis.preferencias,'Campanhas',extras[2].lista||[],[['sigla','Sigla'],['nome','Nome']],editar('territorios'),lista=>store.salvar('terr_tj_config','campanhas',{lista,updatedAt:new Date().toISOString()}));
      }
      const ferramentas=el('details','dz-card');ferramentas.appendChild(el('summary','','Ferramentas avançadas'));
      for(const m of ['oradores','territorios'])if(editar(m)){const a=el('a','dz-btn',m==='oradores'?'Importação, lixeira e correção manual da Sentinela':'Importação e manutenção de territórios');a.href='/'+m+'?ferramentas=1#config';ferramentas.appendChild(a);}
      paineis.preferencias.appendChild(ferramentas);
      if(!ver('oradores')&&!ver('designacoes'))botoes.reunioes.hidden=true;
      abrir('congregacao');montado=vinc.workspaceId;
    }catch(error){container.replaceChildren(el('p','save-status',error.message));const retry=el('button','dz-btn','Tentar novamente');retry.onclick=()=>montar({container,vinc,user});container.appendChild(retry);}
  }
  function listaEditavel(pai,titulo,lista,campos,pode,salvar){
    let linhas=[];const f=formulario(pai,titulo,pode,()=>{
      const valores=linhas.map(r=>({...r.original,...Object.fromEntries(campos.map(([k])=>[k,r.inputs[k].value.trim()]))}));
      if(valores.some(r=>campos.some(([k])=>!r[k])))throw new Error('Preencha todos os campos dos itens ou remova os itens vazios.');
      return salvar(valores);
    });const box=el('div');f.body.appendChild(box);
    function adicionar(original={}){
      const row=el('fieldset','settings-item'),inputs={};row.appendChild(el('legend','','Item da lista'));campos.forEach(([key,label,tipo])=>inputs[key]=campo(row,label,original[key]||(key==='tipo'?'geral':''),tipo||'text',key==='tipo'?[['convite','Convite'],['geral','Geral']]:undefined));
      const remove=el('button','dz-btn danger','Remover item');remove.type='button';remove.onclick=()=>{if(!confirm('Remover este item? A remoção será aplicada ao salvar a lista.'))return;row.remove();linhas=linhas.filter(l=>l.row!==row);FormUX.rastrear(f.form,f.button,f.status).marcar();};row.appendChild(remove);box.appendChild(row);linhas.push({row,inputs,original});
    }
    lista.forEach(adicionar);const add=el('button','dz-btn','Adicionar item');add.type='button';add.onclick=()=>{adicionar({id:Date.now()});FormUX.rastrear(f.form,f.button,f.status).marcar();};f.body.appendChild(add);
  }
  root.ConfigCentral={montar};
})(window);
