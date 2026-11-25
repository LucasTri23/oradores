(function(root){
  let montado=null,sequencia=0;
  const el=(tag,classe,texto)=>{const n=document.createElement(tag);if(classe)n.className=classe;if(texto)n.textContent=texto;return n;};
  function campo(pai,titulo,valor,tipo='text',opcoes){
    const box=el('div','native-field'),label=el('label','',titulo),input=el(opcoes?'select':tipo==='textarea'?'textarea':'input');
    input.id='preferencia-'+(++sequencia);label.htmlFor=input.id;
    if(opcoes)opcoes.forEach(([v,t])=>input.add(new Option(t,String(v))));else if(tipo!=='textarea')input.type=tipo;
    if(tipo==='checkbox'){input.checked=!!valor;box.classList.add('settings-check');}else input.value=valor??'';
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
      container.replaceChildren();container.classList.add('settings-center');const nav=el('nav','config-tabs');nav.setAttribute('aria-label','Seções das configurações');container.appendChild(nav);
      const paineis={},botoes={};
      const descricoes={congregacao:'Identificação da congregação e acesso ao aplicativo.',reunioes:'Defina os dias e horários usados nas programações.',funcoes:'Escolha as funções usadas e quem pode realizá-las.',campo:'Organize os locais e os horários semanais de saída.',equipe:'Gerencie os módulos, os convites e as permissões de acesso.',preferencias:'Prepare mensagens e mantenha os cadastros de territórios organizados.'};
      for(const [key,nome] of [['congregacao','Congregação'],['reunioes','Reuniões'],['funcoes','Funções'],['campo','Campo'],['equipe','Equipe'],['preferencias','Mensagens e territórios']]){
        const painel=el('section','config-panel'),b=el('button','dz-btn',nome);painel.id='preferencias-'+key;b.type='button';b.setAttribute('aria-controls',painel.id);b.onclick=()=>abrir(key);botoes[key]=b;paineis[key]=painel;nav.appendChild(b);container.appendChild(painel);
        const intro=el('header','settings-panel-heading'),titulo=el('h2','',nome);titulo.id=painel.id+'-titulo';intro.append(titulo,el('p','',descricoes[key]));painel.setAttribute('aria-labelledby',titulo.id);painel.appendChild(intro);
      }
      function abrir(key){Object.entries(paineis).forEach(([k,p])=>{p.hidden=k!==key;botoes[k].setAttribute('aria-pressed',String(k===key));});}
      for(const [id,key] of [['configNomeCard','congregacao'],['configInstalarCard','congregacao'],['configAcessoCard','equipe'],['painelDono','equipe']]){const card=document.getElementById(id);if(card)paineis[key].appendChild(card);}
      const nomeCard=document.getElementById('configNomeCard'),nomeBtn=document.getElementById('cfgNomeBtn'),nomeStatus=el('p','save-status');nomeStatus.id='cfgNomeStatus';nomeStatus.setAttribute('role','status');nomeStatus.setAttribute('aria-live','polite');
      const nomeFooter=el('div','save-bar');nomeBtn.textContent='Salvar alterações';nomeFooter.append(nomeBtn,nomeStatus);nomeCard.appendChild(nomeFooter);FormUX.rastrear(nomeCard,nomeBtn,nomeStatus);
      if(ver('oradores')){
        let endereco,horario,dia,dia2027=null,sentinela;
        // Antes de 2027: campo extra para o dia de 2027. Depois: o dia de 2027 vira o padrão (e o campo some).
        const fimValido=v=>v===0||v===6,ver2027=Regras.mostrarPergunta2027();
        const f=formulario(paineis.reunioes,'Discursos públicos',editar('oradores'),()=>store.salvar('config','app',{end:endereco.value.trim(),hor:horario.value,dia:Number(dia.value),dia2027:dia2027&&dia2027.value!==''?Number(dia2027.value):null,sugerirSentinela:sentinela.checked}));
        endereco=campo(f.body,'Endereço da reunião',o.end||'');horario=campo(f.body,'Horário',o.hor||'19:00','time');
        dia=campo(f.body,'Dia do fim de semana',!ver2027&&fimValido(o.dia2027)?o.dia2027:(o.dia??6),'select',[[6,'Sábado'],[0,'Domingo']]);
        if(ver2027)dia2027=campo(f.body,'Dia do fim de semana em 2027',o.dia2027??'','select',[['','Igual ao de cima'],[6,'Sábado'],[0,'Domingo']]);
        sentinela=campo(f.body,'Sugerir discursos relacionados à Sentinela',o.sugerirSentinela,'checkbox');
        let grupo;const g=formulario(paineis.preferencias,'Mensagem do grupo — Oradores',editar('oradores'),()=>store.salvar('config','app',{groupMsg:grupo.value.trim()}));grupo=campo(g.body,'Modelo da mensagem (variáveis como {orador}, {tema} e {data})',o.groupMsg||'','textarea');
        listaEditavel(paineis.preferencias,'Mensagens para oradores',mensagens.lista||[],[['titulo','Título'],['tipo','Tipo (convite ou geral)'],['texto','Mensagem','textarea']],editar('oradores'),lista=>store.salvar('config','mensagens',{lista}));
      }
      if(ver('designacoes')){
        let meio,fim,meio2027=null,fim2027=null;
        const ver2027=Regras.mostrarPergunta2027(),num=v=>v===''||v==null?null:Number(v);
        const meioValido=v=>Number.isInteger(v)&&v>=1&&v<=5,fimValido=v=>v===0||v===6;
        const r=formulario(paineis.reunioes,'Datas das Designações',editar('designacoes'),()=>store.salvar('desig_config','app',{
          diaMeio:num(meio.value),diaMeio2027:meio2027?num(meio2027.value):null,
          ...(!ver('oradores')?{diaFim:Number(fim.value),diaFim2027:fim2027?num(fim2027.value):null}:{})
        }));
        const diasMeio=[1,2,3,4,5].map(n=>[n,Regras.DIAS[n]]);
        meio=campo(r.body,'Reunião do meio de semana',!ver2027&&meioValido(d.diaMeio2027)&&d.diaMeio!=null?d.diaMeio2027:(d.diaMeio??''),'select',[['','Ainda não definido'],...diasMeio]);
        if(ver2027)meio2027=campo(r.body,'Reunião do meio de semana em 2027',d.diaMeio2027??'','select',[['','Igual ao de cima'],...diasMeio]);
        if(!ver('oradores')){
          fim=campo(r.body,'Reunião do fim de semana',!ver2027&&fimValido(d.diaFim2027)?d.diaFim2027:(d.diaFim??6),'select',[[6,'Sábado'],[0,'Domingo']]);
          if(ver2027)fim2027=campo(r.body,'Reunião do fim de semana em 2027',d.diaFim2027??'','select',[['','Igual ao de cima'],[6,'Sábado'],[0,'Domingo']]);
        }
        else r.body.appendChild(el('p','hint','O fim de semana segue os dias definidos em Discursos públicos, acima.'));
        if(ver2027)r.body.appendChild(el('p','hint','Os campos "em 2027" mudam só as datas de 2027 e somem quando o ano virar; a partir daí, o dia escolhido para 2027 passa a ser o padrão.'));
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
        await funcoesDasPessoas(paineis.funcoes,d,editar('designacoes'),sb,vinc,user);
        await saidasCampo(paineis.campo,d,editar('designacoes'),store);
      }else{botoes.funcoes.hidden=true;botoes.campo.hidden=true;}
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
  // Quem pode fazer cada função (desig_pessoas → funcoes), com os nomes da lista da congregação.
  async function funcoesDasPessoas(pai,d,pode,sb,vinc,user){
    const C=Congregacao,ws=vinc.workspaceId;
    const [central,desig]=await Promise.all([C.listar(sb,ws,'cong_pessoas').catch(()=>[]),C.listar(sb,ws,'desig_pessoas')]);
    const porId=new Map(desig.map(p=>[p.id,p]));
    // Lista da congregação + quem só existe nas Designações (cadastros antigos).
    const ordemGrupo={anciao:0,servo:1,publicador:2};
    const pessoas=[...central,...desig.filter(p=>p.nome&&!central.some(c=>c.id===p.id||C.normalizar(c.nome)===C.normalizar(p.nome)))]
      .filter(p=>p.nome&&p.ativo!==false).sort((a,b)=>(ordemGrupo[a.grupo]??3)-(ordemGrupo[b.grupo]??3)||a.nome.localeCompare(b.nome,'pt-BR'));
    const q=Regras.quantidades(d);
    const colunas=[...Object.keys(Regras.FUNCOES).filter(f=>(q.meio[f]||0)+(q.fim[f]||0)>0).map(f=>[f,Regras.FUNCOES[f]]),[Regras.FUNCAO_CAMPO.chave,Regras.FUNCAO_CAMPO]];
    const linhas=[];
    const f=formulario(pai,'Funções das pessoas',pode,async()=>{
      const mudaram=linhas.filter(l=>l.caixas.some(([k,cb])=>cb.checked!==!!l.funcoes[k]));
      for(const l of mudaram){
        const funcoes={...l.funcoes};l.caixas.forEach(([k,cb])=>{if(cb.checked)funcoes[k]=true;else delete funcoes[k];});
        await C.salvar(sb,ws,user.id,'desig_pessoas',l.id,{...(porId.get(l.id)||{}),funcoes});
        l.funcoes=funcoes;porId.set(l.id,{...(porId.get(l.id)||{}),funcoes});
      }
    });
    f.body.appendChild(el('p','hint','Selecione as funções que cada pessoa pode realizar. Pessoas inativas não aparecem nesta lista. Salve as alterações ao terminar.'));
    if(!pessoas.length){f.body.appendChild(el('p','hint','Nenhuma pessoa cadastrada ainda. Cadastre em Início → Pessoas.'));f.button.hidden=true;return;}
    const busca=el('input','pf-busca');busca.type='search';busca.placeholder='Buscar nome…';busca.setAttribute('aria-label','Buscar pessoa');
    // A busca não conta como alteração do formulário.
    ['input','change'].forEach(ev=>busca.addEventListener(ev,e=>e.stopPropagation()));
    f.body.appendChild(busca);
    const tabela=el('table','pf-tabela'),thead=el('thead'),trh=el('tr'),tbody=el('tbody');
    trh.appendChild(el('th','pf-nome','Nome'));
    colunas.forEach(([,info])=>{const th=el('th','',info.curto||info.nome);th.title=info.nome;th.scope='col';trh.appendChild(th);});
    thead.appendChild(trh);tabela.append(thead,tbody);
    pessoas.forEach(p=>{
      const tr=el('tr'),th=el('th','pf-nome');th.scope='row';
      th.appendChild(el('strong','',p.nome));th.appendChild(el('small','',C.GRUPOS?.[p.grupo||'']||''));tr.appendChild(th);
      const funcoes={...(porId.get(p.id)?.funcoes||{})},caixas=[];
      colunas.forEach(([k,info])=>{
        const td=el('td'),label=el('label','pf-escolha'),cb=el('input'),texto=el('span','pf-funcao',info.curto||info.nome);
        cb.type='checkbox';cb.disabled=!pode;cb.checked=!!funcoes[k];cb.setAttribute('aria-label',p.nome+' — '+info.nome);
        label.append(cb,texto);td.appendChild(label);tr.appendChild(td);caixas.push([k,cb]);
      });
      tbody.appendChild(tr);linhas.push({id:p.id,nome:p.nome,funcoes,caixas,tr});
    });
    busca.oninput=()=>{const t=C.normalizar(busca.value);linhas.forEach(l=>l.tr.hidden=!!t&&!C.normalizar(l.nome).includes(t));};
    const wrap=el('div','table-scroll pf-wrap');wrap.appendChild(tabela);f.body.appendChild(wrap);
  }
  // Locais e dias da semana das saídas de campo (desig_config → campo:{locais,saidas}).
  async function saidasCampo(pai,d,pode,store){
    const novoId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const prefs=await store.ler('desig_config','campo_quadro');
    let ocultos=new Set((prefs.diasOcultos||[]).filter(d=>Number.isInteger(d)&&d>=0&&d<=6)),salvandoDia=false;
    const ordem=[1,2,3,4,5,6,0],dias=Regras.DIAS.map(n=>n.toLocaleUpperCase('pt-BR')),colunas=new Map();
    let locais=[],saidas=[];
    const f=formulario(pai,'Saídas de campo',pode,()=>{
      const ls=locais.map(l=>({id:l.id,nome:l.nome.value.trim(),endereco:l.endereco.value.trim()}));
      if(ls.some(l=>!l.nome))throw new Error('Dê um nome para cada local ou remova os locais vazios.');
      const ss=saidas.map(x=>({id:x.id,dia:Number(x.dia.value),hora:x.hora.value,localId:x.local.value}));
      if(ss.some(x=>!Regras.horaValida(x.hora)))throw new Error('Informe o horário de cada saída.');
      if(ls.length&&ss.some(x=>!x.localId))throw new Error('Escolha o local de cada saída.');
      return store.salvar('desig_config','app',{campo:{locais:ls,saidas:ss}});
    });
    f.form.classList.add('cfg-campo-form');
    f.body.appendChild(el('p','hint','Organize os horários em cada dia da semana. Toque em um local para editar seus dados. Salve as alterações ao terminar. Os dirigentes são escolhidos em Designações → Campo.'));
    const tituloL=el('h3','sub-titulo','Locais de encontro'),boxL=el('div','cfg-campo-locais'),addL=el('button','dz-btn','+ Adicionar local');addL.type='button';
    const tituloS=el('h3','sub-titulo','Dias e horários'),boxS=el('div','cfg-campo-board'),ocultosBox=el('details','cfg-campo-ocultos');
    f.body.append(tituloL,boxL,addL,tituloS,ocultosBox,boxS);
    const avisoDia=el('p','save-status');avisoDia.setAttribute('role','status');f.body.appendChild(avisoDia);
    const atalhos=el('nav','cfg-campo-nav');atalhos.setAttribute('aria-label','Dias de campo');boxS.before(atalhos);
    async function mudarDia(dia,ocultar){
      if(!pode||salvandoDia)return;
      if(ocultar&&!confirm('Ocultar '+dias[dia]+' nas telas de Campo? Nenhuma saída será cancelada ou apagada. Reative em Dias ocultos.'))return;
      salvandoDia=true;avisoDia.textContent='Salvando visibilidade do dia…';
      try{
        const atual=await store.ler('desig_config','campo_quadro'),next=new Set(atual.diasOcultos||[]);
        if(ocultar)next.add(dia);else next.delete(dia);
        await store.salvar('desig_config','campo_quadro',{diasOcultos:[...next]});ocultos=next;atualizarDias();
        avisoDia.textContent=ocultar?'Dia ocultado. Os agendamentos foram preservados.':'Dia reativado.';
      }catch(e){avisoDia.textContent='Não foi possível alterar o dia: '+e.message;}finally{salvandoDia=false;}
    }
    function atualizarDias(){
      atalhos.replaceChildren();ocultosBox.replaceChildren(el('summary','','Dias ocultos ('+ocultos.size+')'));
      ocultosBox.hidden=!ocultos.size;
      ocultosBox.appendChild(el('p','hint','Ocultar só esconde a coluna; não cancela saídas. A visibilidade é salva automaticamente para a congregação.'));
      ordem.forEach(dia=>{
        const c=colunas.get(dia);c.col.hidden=ocultos.has(dia);
        c.total.textContent=saidas.filter(s=>Number(s.dia.value)===dia).length+' horário(s)';
        c.vazio.hidden=saidas.some(s=>Number(s.dia.value)===dia);
        if(ocultos.has(dia)){const b=el('button','dz-btn','Reativar '+dias[dia]);b.type='button';b.disabled=!pode;b.onclick=()=>mudarDia(dia,false);ocultosBox.appendChild(b);}
        else{const b=el('button','dz-btn',dias[dia]);b.type='button';b.onclick=()=>c.col.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'});atalhos.appendChild(b);}
      });
    }
    ordem.forEach(dia=>{
      const col=el('section','cfg-campo-col'),head=el('div','cfg-campo-head'),total=el('small'),vazio=el('p','hint','Nenhum horário. Adicione uma saída neste dia.'),lista=el('div','cfg-campo-saidas');
      head.append(el('h4','',dias[dia]),total);
      const hide=el('button','cfg-campo-hide','Ocultar');hide.type='button';hide.hidden=!pode;hide.setAttribute('aria-label','Ocultar '+dias[dia]);hide.onclick=()=>mudarDia(dia,true);head.appendChild(hide);
      const add=el('button','dz-btn cfg-campo-add','+ Adicionar saída');add.type='button';add.hidden=!pode;add.onclick=()=>{addSaida({dia});marcar();};
      col.append(head,add,vazio,lista);boxS.appendChild(col);colunas.set(dia,{col,total,vazio,lista});
    });
    const marcar=()=>FormUX.rastrear(f.form,f.button,f.status).marcar();
    function atualizarLocais(){
      const opcoes=locais.map(l=>[l.id,l.nome.value.trim()||'(sem nome)']);
      saidas.forEach(x=>{const v=x.local.value;x.local.replaceChildren(new Option(opcoes.length?'Escolha o local…':'Cadastre um local acima',''));opcoes.forEach(([id,n])=>x.local.add(new Option(n,id)));x.local.value=opcoes.some(([id])=>id===v)?v:'';});
    }
    function addLocal(l={}){
      const card=el('details','cfg-campo-local'),summary=el('summary','',l.nome||'Novo local');card.open=!l.id;card.appendChild(summary);
      const row=el('fieldset','settings-item');card.appendChild(row);
      const item={id:l.id||novoId('l'),row};
      item.nome=campo(row,'Nome do local',l.nome||'');item.nome.placeholder='Ex.: Salão do Reino, casa da família Souza';
      item.endereco=campo(row,'Endereço (opcional)',l.endereco||'');
      item.nome.addEventListener('input',()=>{summary.textContent=item.nome.value.trim()||'Novo local';atualizarLocais();});
      const rm=el('button','dz-btn danger','Remover local');rm.type='button';
      rm.onclick=()=>{if(!confirm('Remover este local? As saídas que usam este local vão pedir outro local.'))return;card.remove();locais=locais.filter(x=>x!==item);atualizarLocais();marcar();};
      row.appendChild(rm);boxL.appendChild(card);locais.push(item);
    }
    function addSaida(x={}){
      const row=el('fieldset','settings-item');row.appendChild(el('legend','','Saída'));
      const item={id:x.id||novoId('s'),row};
      item.dia=campo(row,'Mover para outro dia',x.dia??6,'select',dias.map((n,i)=>[i,n]));
      item.dia.onchange=()=>{colunas.get(Number(item.dia.value)).lista.appendChild(row);atualizarDias();if(ocultos.has(Number(item.dia.value)))avisoDia.textContent='A saída foi movida para um dia oculto. Reative-o em Dias ocultos para editar.';};
      item.hora=campo(row,'Horário',x.hora||'09:00','time');
      item.local=campo(row,'Local',x.localId||'','select',[['','']]);
      const rm=el('button','dz-btn danger','Remover saída');rm.type='button';
      rm.onclick=()=>{if(!confirm('Remover esta saída? As designações já feitas continuam no histórico.'))return;row.remove();saidas=saidas.filter(s=>s!==item);atualizarDias();marcar();};
      row.appendChild(rm);colunas.get(Number(item.dia.value)).lista.appendChild(row);saidas.push(item);
      atualizarLocais();item.local.value=x.localId||'';
      atualizarDias();
    }
    Regras.locaisCampo(d).forEach(addLocal);
    Regras.saidasCampo(d).forEach(addSaida);
    addL.onclick=()=>{addLocal();atualizarLocais();marcar();};
    atualizarDias();
    if(!pode)addL.hidden=true;
  }
  function listaEditavel(pai,titulo,lista,campos,pode,salvar){
    const tipo=titulo.startsWith('Dirigentes')?'dirigente':titulo==='Campanhas'?'campanha':'mensagem';
    const descricao=tipo==='dirigente'?'Contatos para compartilhar as designações de territórios.':tipo==='campanha'?'Organize cada campanha com uma sigla e um nome.':'Textos para reutilizar nos compartilhamentos. Emojis são opcionais.';
    let linhas=[];const f=formulario(pai,titulo,pode,()=>{
      const valores=linhas.map(r=>({...r.original,...Object.fromEntries(campos.map(([k])=>[k,r.inputs[k].value.trim()]))}));
      if(valores.some(r=>campos.some(([k])=>!r[k])))throw new Error('Preencha os campos dos itens ou remova os itens vazios.');
      return salvar(valores);
    });f.form.classList.add('settings-list-form');
    const toolbar=el('div','settings-list-toolbar'),count=el('span'),empty=el('p','settings-list-empty','Nenhum item cadastrado. Use o botão acima para começar.'),box=el('div','settings-list-items');
    const add=el('button','dz-btn pri','+ Adicionar '+tipo);add.type='button';add.hidden=!pode;
    toolbar.append(count,add);f.body.append(el('p','settings-list-description',descricao),toolbar,empty,box);
    const atualizar=()=>{count.textContent=linhas.length+' cadastrado(s)';empty.hidden=linhas.length>0;};
    function adicionar(original={},abrir=false){
      const row=el('details','settings-list-item'),summary=el('summary'),heading=el('strong'),preview=el('span'),body=el('div','settings-list-fields'),inputs={};
      summary.append(heading,preview);row.append(summary,body);row.open=abrir;
      campos.forEach(([key,label,tipoCampo])=>{inputs[key]=campo(body,label,original[key]||(key==='tipo'?'geral':''),tipoCampo||(key==='num'?'tel':'text'),key==='tipo'?[['convite','Convite'],['geral','Geral']]:undefined);inputs[key].required=true;});
      const resumir=()=>{heading.textContent=inputs.nome?.value||inputs.titulo?.value||inputs.label?.value||'Novo cadastro';preview.textContent=inputs.num?.value||inputs.sigla?.value||inputs.texto?.value||'Preencha os dados';};
      row.addEventListener('input',resumir);resumir();row.addEventListener('invalid',()=>row.open=true,true);
      const remove=el('button','dz-btn danger','Remover '+tipo);remove.type='button';remove.hidden=!pode;
      remove.onclick=()=>{if(!confirm('Remover este item? A remoção será aplicada ao salvar a lista.'))return;row.remove();linhas=linhas.filter(l=>l.row!==row);atualizar();FormUX.rastrear(f.form,f.button,f.status).marcar();};
      body.appendChild(remove);box.appendChild(row);linhas.push({row,inputs,original});atualizar();if(abrir)inputs[campos[0][0]].focus();
    }
    lista.forEach(item=>adicionar(item));atualizar();add.onclick=()=>{adicionar({id:Date.now()},true);FormUX.rastrear(f.form,f.button,f.status).marcar();};
  }
  root.ConfigCentral={montar};
})(window);
