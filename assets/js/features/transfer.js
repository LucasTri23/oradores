// IMPORT EMBUTIDO
let xlsxParsed=null,importMode='historico';
function resetImportModal(mode){
  importMode=mode;xlsxParsed=null;document.getElementById('xlsxFile').value='';
  document.querySelector('#mImportXlsx .modal-title').textContent=mode==='oradores'?'📂 Importar primeira lista de oradores':'📂 Importar histórico e programação';
  document.getElementById('xlsxInfo').textContent=mode==='oradores'?'Colunas aceitas: Nome, Congregação, Telefone, Último Discurso, Nota e Observação.':'Colunas aceitas: Data, Orador, Congregação, Telefone, Nº Tema e Tema.';
  document.getElementById('impLogXlsx').textContent='Selecione um arquivo...';document.getElementById('impBarXlsx').style.width='0';
  document.getElementById('impBtnsXlsx').innerHTML='<button class="btn bp" id="btnImportXlsx" onclick="startImportXlsx()" disabled style="opacity:.4">▶ Importar</button><button class="btn bo" onclick="closeM(\'mImportXlsx\')">Cancelar</button>';
  openM('mImportXlsx');
}
function openImportOradores(){resetImportModal('oradores');}
function openImportHistorico(){resetImportModal('historico');}
function dadosOradorCompartilhavel(o,opcoes={}){
  const dados={nome:o.nome,cong:o.cong||'',minhaCongregacao:false};
  if(opcoes.telefone)dados.tel=o.tel||'';
  if(opcoes.observacoes)dados.obs=o.obs||'';
  if(opcoes.avaliacao)dados.nota=o.nota||0;
  if(o.ultimoDiscurso)dados.ultimoDiscurso=o.ultimoDiscurso;
  return dados;
}
async function gerarLinkOradores(lista,titulo,opcoes){
  if(!supabase||!currentUser)return toast('Entre com Google primeiro.');
  if(!lista.length)return toast('Não há oradores para compartilhar.');
  try{
    const copia=lista.map(o=>dadosOradorCompartilhavel(o,opcoes));
    const{data,error}=await supabase.from('speaker_shares').insert({payload:copia}).select('token').single();if(error)throw error;
    const link=location.origin+location.pathname+'?import='+encodeURIComponent(data.token);
    mostrarLinkCompartilhamento(link,titulo,lista.length);
  }catch(e){if(e.name!=='AbortError')toast('Erro ao compartilhar: '+e.message,5000);}
}
function mostrarLinkCompartilhamento(link,titulo,total){
  document.getElementById('resultadoCompartilhamento')?.remove();const overlay=document.createElement('div');overlay.id='resultadoCompartilhamento';overlay.className='choice-overlay';
  const modal=document.createElement('div');modal.className='choice-modal';modal.innerHTML='<div class="choice-title">Link pronto</div><p class="choice-hint">'+total+' orador'+(total===1?'':'es')+' selecionado'+(total===1?'':'s')+'. O link expira em 7 dias.</p>';
  const campo=document.createElement('input');campo.readOnly=true;campo.value=link;modal.appendChild(campo);const actions=document.createElement('div');actions.className='topic-warning-actions';
  const fechar=document.createElement('button');fechar.className='btn bo';fechar.textContent='Fechar';fechar.onclick=()=>overlay.remove();
  const copiar=document.createElement('button');copiar.className='btn bo';copiar.textContent='Copiar link';copiar.onclick=async()=>{await navigator.clipboard.writeText(link);copiar.textContent='✓ Copiado';};
  const enviar=document.createElement('button');enviar.className='btn bp';enviar.innerHTML='<i data-lucide="share-2"></i> Enviar';enviar.onclick=async()=>{if(navigator.share)await navigator.share({title,text:'Abra o link para importar os oradores:',url:link});else{await navigator.clipboard.writeText(link);toast('✓ Link copiado!');}};
  actions.appendChild(fechar);actions.appendChild(copiar);actions.appendChild(enviar);modal.appendChild(actions);overlay.appendChild(modal);document.body.appendChild(overlay);if(window.lucide)lucide.createIcons();
}
async function enviarConviteInternoOradores(lista,opcoes){
  document.getElementById('destinoShareInterno')?.remove();
  const overlay=document.createElement('div');overlay.id='destinoShareInterno';overlay.className='choice-overlay';
  const modal=document.createElement('div');modal.className='choice-modal';
  modal.innerHTML='<div class="choice-title">Enviar pelo sistema</div><p class="choice-hint">Informe o código de 8 caracteres fornecido pela congregação destinatária.</p>';
  const campo=document.createElement('input');campo.placeholder='Ex.: A1B2C3D4';campo.maxLength=8;campo.autocomplete='off';campo.style.textTransform='uppercase';modal.appendChild(campo);
  const resumo=document.createElement('p');resumo.className='choice-hint';resumo.textContent=lista.length+' orador'+(lista.length===1?'':'es')+' será'+(lista.length===1?'':'ão')+' enviado'+(lista.length===1?'':'s')+'. O convite expira em 7 dias.';modal.appendChild(resumo);
  const actions=document.createElement('div');actions.className='topic-warning-actions';
  const cancelar=document.createElement('button');cancelar.className='btn bo';cancelar.textContent='Voltar';cancelar.onclick=()=>overlay.remove();
  const enviar=document.createElement('button');enviar.className='btn bp';enviar.textContent='Enviar convite';
  enviar.onclick=async()=>{const codigo=campo.value.trim();if(codigo.length!==8)return toast('Informe um código válido de 8 caracteres.');enviar.disabled=true;enviar.textContent='Enviando...';try{const payload=lista.map(o=>dadosOradorCompartilhavel(o,opcoes));const{error}=await supabase.rpc('send_speaker_share_invite',{sender_workspace:activeWorkspaceId,target_code:codigo,speakers:payload});if(error)throw error;overlay.remove();toast('✓ Convite enviado dentro do sistema.',5000);}catch(e){enviar.disabled=false;enviar.textContent='Enviar convite';toast('Não foi possível enviar: '+e.message,6000);}};
  actions.appendChild(cancelar);actions.appendChild(enviar);modal.appendChild(actions);overlay.appendChild(modal);document.body.appendChild(overlay);campo.focus();
}
async function carregarConvitesOradores(){
  if(!supabase||!currentUser)return[];const{data,error}=await supabase.rpc('list_speaker_share_invites');if(error)throw error;return data||[];
}
async function responderConviteOradores(convite,aceitar){
  if(aceitar&&!(await revisarImportacaoCompartilhada(Array.isArray(convite.payload)?convite.payload:[])))return false;
  try{const{data,error}=await supabase.rpc('respond_speaker_share_invite',{share_invite_id:convite.id,accept_invite:aceitar});if(error)throw error;if(aceitar){await loadOradores();toast('✓ '+data.added+' oradores importados; '+data.duplicates+' duplicados ignorados.',6000);}else toast('Convite recusado.');return true;}catch(e){toast('Não foi possível responder: '+e.message,6000);return false;}
}
async function compartilharOrador(id){
  const orador=oradores.find(o=>o.id===id);if(!orador)return toast('Orador não encontrado.');
  if(!ehDaMinhaCongregacao(orador))return toast('Só é permitido compartilhar oradores da sua congregação.',5000);
  return abrirModalCompartilhar([orador]);
}
function compartilharOradores(){
  const congregacao=normalizarCongregacao(cfg.cong),lista=oradores.filter(ehDaMinhaCongregacao);
  if(!congregacao)return toast('Configure primeiro o nome da sua congregação.');
  if(!lista.length)return toast('Nenhum orador cadastrado na congregação "'+cfg.cong+'".',5000);
  abrirModalCompartilhar(lista);
}
function abrirModalCompartilhar(lista){
  document.getElementById('selecionarOradoresShare')?.remove();
  const overlay=document.createElement('div');overlay.id='selecionarOradoresShare';overlay.className='choice-overlay';
  const modal=document.createElement('div');modal.className='choice-modal share-speakers-modal';
  const titulo=document.createElement('div');titulo.className='choice-title';titulo.textContent='Compartilhar oradores';modal.appendChild(titulo);
  const ajuda=document.createElement('p');ajuda.className='choice-hint';ajuda.textContent='Selecione quais oradores de '+cfg.cong+' deseja enviar para outra congregação.';modal.appendChild(ajuda);
  const tools=document.createElement('div');tools.className='share-speakers-tools';
  const todos=document.createElement('button');todos.type='button';todos.className='btn bo bs';todos.textContent='Selecionar todos';
  const nenhum=document.createElement('button');nenhum.type='button';nenhum.className='btn bo bs';nenhum.textContent='Limpar';tools.appendChild(todos);tools.appendChild(nenhum);modal.appendChild(tools);
  const itens=document.createElement('div');itens.className='share-speakers-list';
  lista.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR')).forEach(o=>{
    const label=document.createElement('label');label.className='share-speaker-option';
    const input=document.createElement('input');input.type='checkbox';input.value=o.id;input.checked=lista.length===1;
    const info=document.createElement('span'),nome=document.createElement('strong'),telefone=document.createElement('small');nome.textContent=o.nome;telefone.textContent=o.tel||'Sem telefone';info.appendChild(nome);info.appendChild(telefone);label.appendChild(input);label.appendChild(info);itens.appendChild(label);
  });
  modal.appendChild(itens);
  const campos=document.createElement('div');campos.className='share-fields';campos.innerHTML='<strong>Informações compartilhadas</strong><small>Nome, congregação e último discurso são incluídos. Escolha os campos opcionais:</small>';
  [['shareTel','Telefone',true],['shareObs','Observações',false],['shareNota','Avaliação',false]].forEach(([id,texto,checked])=>{const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.id=id;input.checked=checked;label.appendChild(input);label.appendChild(document.createTextNode(texto));campos.appendChild(label);});modal.appendChild(campos);
  const contador=document.createElement('div');contador.className='share-speakers-count';modal.appendChild(contador);
  const actions=document.createElement('div');actions.className='topic-warning-actions';
  const cancelar=document.createElement('button');cancelar.type='button';cancelar.className='btn bo';cancelar.textContent='Cancelar';cancelar.onclick=()=>overlay.remove();
  const link=document.createElement('button');link.type='button';link.className='btn bo';link.textContent='Gerar link';
  const compartilhar=document.createElement('button');compartilhar.type='button';compartilhar.className='btn bp';compartilhar.innerHTML='<i data-lucide="send"></i> Enviar pelo sistema';
  const atualizar=()=>{const n=itens.querySelectorAll('input:checked').length;contador.textContent=n+' de '+lista.length+' selecionado'+(n===1?'':'s');[link,compartilhar].forEach(b=>{b.disabled=n===0;b.style.opacity=n?'1':'.5';});};
  itens.addEventListener('change',atualizar);todos.onclick=()=>{itens.querySelectorAll('input').forEach(i=>i.checked=true);atualizar();};nenhum.onclick=()=>{itens.querySelectorAll('input').forEach(i=>i.checked=false);atualizar();};
  const selecionadosEOpcoes=()=>{const ids=new Set([...itens.querySelectorAll('input:checked')].map(i=>i.value));return{selecionados:lista.filter(o=>ids.has(o.id)),opcoes:{telefone:document.getElementById('shareTel').checked,observacoes:document.getElementById('shareObs').checked,avaliacao:document.getElementById('shareNota').checked}};};
  link.onclick=async()=>{const{selecionados,opcoes}=selecionadosEOpcoes();if(!selecionados.length)return;overlay.remove();await gerarLinkOradores(selecionados,'Oradores de '+cfg.cong,opcoes);};
  compartilhar.onclick=()=>{const{selecionados,opcoes}=selecionadosEOpcoes();if(!selecionados.length)return;overlay.remove();enviarConviteInternoOradores(selecionados,opcoes);};
  actions.appendChild(cancelar);actions.appendChild(link);actions.appendChild(compartilhar);modal.appendChild(actions);overlay.appendChild(modal);document.body.appendChild(overlay);atualizar();if(window.lucide)lucide.createIcons();
}
async function checkSharedImport(){
  const token=new URLSearchParams(location.search).get('import');if(!token||!supabase||!currentUser)return;
  try{
    const{data,error}=await supabase.rpc('get_shared_speakers',{share_token:token});if(error)throw error;
    const lista=Array.isArray(data)?data:[];if(!lista.length)throw new Error('Este link expirou ou não existe.');
    if(await revisarImportacaoCompartilhada(lista)){
      const existentes=new Set(oradores.map(chaveIdentidadeOrador));let novos=0;
      for(const o of lista){const chave=chaveIdentidadeOrador(o);if(o.nome&&!existentes.has(chave)){await FF.add(FF.col(db,'oradores'),o);existentes.add(chave);novos++;}}
      await loadOradores();toast('✓ '+novos+' oradores importados; '+(lista.length-novos)+' duplicados ignorados.',5000);
    }
  }catch(e){toast('Não foi possível importar a lista: '+e.message,5000);}
  finally{history.replaceState({},'',location.pathname+location.hash);}
}
function revisarImportacaoCompartilhada(lista){
  return new Promise(resolve=>{
    document.getElementById('revisarImportacaoShare')?.remove();const overlay=document.createElement('div');overlay.id='revisarImportacaoShare';overlay.className='choice-overlay';
    const modal=document.createElement('div');modal.className='choice-modal share-speakers-modal';const titulo=document.createElement('div');titulo.className='choice-title';titulo.textContent='Revisar importação';modal.appendChild(titulo);
    const normalizarTelefone=valor=>{let digitos=String(valor||'').replace(/\D/g,'');if((digitos.length===12||digitos.length===13)&&digitos.startsWith('55'))digitos=digitos.slice(2);return digitos.length>=10?digitos:'';};
    const exatos=new Map(oradores.map(o=>[chaveIdentidadeOrador(o),o])),porNome=new Map(oradores.map(o=>[normalizarTexto(o.nome),o])),porTelefone=new Map();oradores.forEach(o=>{const tel=normalizarTelefone(o.tel);if(tel)porTelefone.set(tel,o);});
    const telefonesRecebidos=new Map();lista.forEach(o=>{const tel=normalizarTelefone(o.tel);if(tel)telefonesRecebidos.set(tel,(telefonesRecebidos.get(tel)||0)+1);});let novos=0,duplicados=0,conflitos=0;
    const listaEl=document.createElement('div');listaEl.className='share-speakers-list';
    lista.forEach(o=>{const exato=exatos.get(chaveIdentidadeOrador(o)),mesmoNome=porNome.get(normalizarTexto(o.nome)),telefone=normalizarTelefone(o.tel),mesmoTelefone=telefone&&porTelefone.get(telefone),telefoneRepetido=telefone&&(telefonesRecebidos.get(telefone)||0)>1;let status='Novo',classe='bgrn';if(exato){const telExistente=normalizarTelefone(exato.tel);if(telefone&&telExistente&&telefone!==telExistente){status='Telefone diferente';classe='bamb';conflitos++;}else{status='Já existe';classe='bgry';duplicados++;}}else if(mesmoTelefone){status='Telefone já cadastrado';classe='bamb';conflitos++;novos++;}else if(telefoneRepetido){status='Telefone repetido na lista';classe='bamb';conflitos++;novos++;}else if(mesmoNome){status='Revisar congregação';classe='bamb';conflitos++;novos++;}else novos++;
      const row=document.createElement('div');row.className='share-import-row';const info=document.createElement('span'),nome=document.createElement('strong'),meta=document.createElement('small'),badge=document.createElement('em');nome.textContent=o.nome||'Sem nome';meta.textContent=(o.cong||'Congregação não informada')+(o.tel?' · '+o.tel:'');info.appendChild(nome);info.appendChild(meta);badge.className='badge '+classe;badge.textContent=status;if(mesmoTelefone)badge.title='Este número já pertence a '+(mesmoTelefone.nome||'outro orador');row.appendChild(info);row.appendChild(badge);listaEl.appendChild(row);
    });
    const resumo=document.createElement('p');resumo.className='choice-hint';resumo.textContent=novos+' novos · '+duplicados+' duplicados'+(conflitos?' · '+conflitos+' com possível conflito':'');modal.appendChild(resumo);modal.appendChild(listaEl);
    const actions=document.createElement('div');actions.className='topic-warning-actions';const cancelar=document.createElement('button');cancelar.className='btn bo';cancelar.textContent='Cancelar';const importar=document.createElement('button');importar.className='btn bp';importar.textContent='Importar '+novos+' novo'+(novos===1?'':'s');importar.disabled=novos===0;importar.style.opacity=novos?'1':'.5';
    const fechar=valor=>{overlay.remove();resolve(valor);};cancelar.onclick=()=>fechar(false);importar.onclick=()=>fechar(true);actions.appendChild(cancelar);actions.appendChild(importar);modal.appendChild(actions);overlay.appendChild(modal);document.body.appendChild(overlay);
  });
}
async function ensureXlsx(){if(window.XLSX)return;await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
function normKey(k){return String(k||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function excelDate(v){if(!v)return'';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'';}const s=String(v).trim();const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:s.slice(0,10);}
async function onXlsxSelect(){
  const file=document.getElementById('xlsxFile').files[0];if(!file)return;
  try{await ensureXlsx();const wb=XLSX.read(await file.arrayBuffer(),{cellDates:true});const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    const cabecalhos=raw.length?Object.keys(raw[0]).map(normKey):[];
    if(cabecalhos.includes('nome')&&cabecalhos.includes('ultimodiscurso')&&!cabecalhos.includes('data'))importMode='oradores';
    else if(cabecalhos.includes('data'))importMode='historico';
    document.querySelector('#mImportXlsx .modal-title').textContent=importMode==='oradores'?'📂 Importar lista de oradores':'📂 Importar histórico e programação';
    xlsxParsed=raw.map(row=>{
      const r={};Object.entries(row).forEach(([k,v])=>r[normKey(k)]=v);
      if(importMode==='oradores')return{nome:String(r.nome||r.orador||'').trim(),cong:String(r.congregacao||r.cong||'').trim(),tel:String(r.telefone||r.whatsapp||r.tel||'').trim(),ultimoDiscurso:excelDate(r.ultimodiscurso||r.ultima||''),nota:Number(r.nota)||0,obs:String(r.observacao||r.obs||'').trim()};
      const temaOriginal=String(r.tema||'').trim();
      const temaComNumero=temaOriginal.match(/^\s*(\d{1,3})\s*[-–—.:]\s*(.+)$/);
      return{data:excelDate(r.data),nome:String(r.orador||r.nome||'').trim(),congregacao:String(r.congregacao||r.cong||'').trim(),telefone:String(r.telefone||r.whatsapp||r.tel||'').trim(),temaNum:Number(r.ntema||r.numerotema||r.temanum)||(temaComNumero?Number(temaComNumero[1]):null),tema:temaComNumero?temaComNumero[2].trim():temaOriginal};
    }).filter(x=>importMode==='oradores'?x.nome:x.data);
    const aba=wb.SheetNames[0];
    document.getElementById('xlsxInfo').textContent=xlsxParsed.length+' registros encontrados em '+file.name+' (aba '+aba+')';
    const b=document.getElementById('btnImportXlsx');if(b){b.disabled=!xlsxParsed.length;b.style.opacity=xlsxParsed.length?'1':'.4';}
  }catch(e){xlsxParsed=null;document.getElementById('xlsxInfo').textContent='Erro ao ler: '+e.message;}
}
async function startImportXlsx(){
  if(!db||!xlsxParsed)return;
  const bar=document.getElementById('impBarXlsx'),log=document.getElementById('impLogXlsx'),btns=document.getElementById('impBtnsXlsx');
  btns.innerHTML='<div class="spin" style="margin:4px 0"></div>';log.textContent='';
  const addLog=m=>{log.textContent+=m+'\n';log.scrollTop=log.scrollHeight;};
  try{
    if(importMode==='oradores'){
      const existentes=new Set(oradores.map(chaveIdentidadeOrador));let novos=0;
      for(let i=0;i<xlsxParsed.length;i++){
        const o=xlsxParsed[i],chave=chaveIdentidadeOrador(o);
        if(!existentes.has(chave)){await FF.add(FF.col(db,'oradores'),o);existentes.add(chave);novos++;}
        bar.style.width=Math.round((i+1)/xlsxParsed.length*100)+'%';
      }
      addLog('OK: '+novos+' oradores importados.');addLog('Ignorados por duplicidade: '+(xlsxParsed.length-novos)+'.');
      await loadOradores();btns.innerHTML='<button class="btn bo" onclick="closeM(\'mImportXlsx\')">Fechar</button>';toast('Lista de oradores importada!');return;
    }

    const hoje=new Date().toISOString().slice(0,10);
    const registrosHistorico=xlsxParsed.filter(p=>p.data&&(p.nome||p.temaNum||p.tema));
    const validos=registrosHistorico.filter(p=>p.nome&&!ehSist(p.nome));
    const chavesDisc=new Set(discursos.map(d=>[d.data,normalizarTexto(d.nome),d.temaNum||''].join('|')));
    const novosDisc=registrosHistorico.filter(p=>!chavesDisc.has([p.data,normalizarTexto(p.nome),p.temaNum||''].join('|')));
    addLog('Registros lidos: '+xlsxParsed.length+'.');
    addLog('Itens novos no histórico: '+novosDisc.length+'. Já existentes: '+(registrosHistorico.length-novosDisc.length)+'.');
    for(let i=0;i<novosDisc.length;i++){await FF.add(FF.col(db,'discursos'),novosDisc[i]);bar.style.width=Math.round((i+1)/Math.max(novosDisc.length,1)*55)+'%';}

    const resumo=new Map();
    validos.forEach(p=>{
      const k=chaveIdentidadeOrador(p),atual=resumo.get(k)||{nome:p.nome,cong:p.congregacao||'',tel:'',ultimoDiscurso:''};
      if(p.telefone)atual.tel=p.telefone;
      if(p.data&&p.data<=hoje&&p.data>atual.ultimoDiscurso)atual.ultimoDiscurso=p.data;
      resumo.set(k,atual);
    });
    const cadastrados=new Map(oradores.map(o=>[chaveIdentidadeOrador(o),o]));let criados=0,atualizados=0;
    for(const [k,o] of resumo){
      const existente=cadastrados.get(k);
      if(!existente){await FF.add(FF.col(db,'oradores'),{nome:o.nome,cong:o.cong,tel:o.tel,ultimoDiscurso:o.ultimoDiscurso||'',nota:0,obs:''});criados++;}
      else{
        const patch={};if(!existente.tel&&o.tel)patch.tel=o.tel;
        if(o.ultimoDiscurso&&(!existente.ultimoDiscurso||o.ultimoDiscurso>existente.ultimoDiscurso))patch.ultimoDiscurso=o.ultimoDiscurso;
        if(Object.keys(patch).length){await FF.upd(FF.doc(db,'oradores',existente.id),patch);atualizados++;}
      }
    }
    bar.style.width='80%';addLog('Oradores criados: '+criados+'. Atualizados: '+atualizados+'.');

    const datasPrograma=new Set(programa.map(p=>p.data));
    const futurasTodas=xlsxParsed.filter(p=>p.data>=hoje),futuras=futurasTodas.filter(p=>!datasPrograma.has(p.data));
    for(let i=0;i<futuras.length;i++){await FF.add(FF.col(db,'programa'),futuras[i]);bar.style.width=80+Math.round((i+1)/Math.max(futuras.length,1)*20)+'%';}
    addLog('Datas futuras novas: '+futuras.length+'. Já existentes: '+(futurasTodas.length-futuras.length)+'.');
    bar.style.width='100%';addLog('Concluído: histórico, oradores e temas sincronizados.');
    await loadAll();btns.innerHTML='<button class="btn bo" onclick="closeM(\'mImportXlsx\')">Fechar</button>';toast('Planilha importada!');
  }catch(e){addLog('ERRO: '+e.message);btns.innerHTML='<button class="btn bo" onclick="closeM(\'mImportXlsx\')">Fechar</button>';}
}

// EXPORT EXCEL
async function exportXlsx(tipo){
  if(!window.XLSX){await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
  let rows=[],fn='';
  if(tipo==='oradores'){fn='oradores.xlsx';rows=[['Nome','Congregação','Telefone','Último Discurso','Nota','Observação']];oradores.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(o=>rows.push([o.nome,o.cong||'',o.tel||'',o.ultimoDiscurso||'',o.nota||0,o.obs||'']));}
  else if(tipo==='programa'){fn='programacao.xlsx';rows=[['Data','Dia','Nº Tema','Tema','Orador','Congregação','Telefone','Obs']];[...programa].sort((a,b)=>a.data>b.data?1:-1).forEach(p=>{const nT=p.temaNum&&TL[p.temaNum]?TL[p.temaNum]:p.tema||'';rows.push([p.data,diaSem(p.data),p.temaNum||'',nT,p.nome||'',p.congregacao||'',p.telefone||'',p.obs||'']);});}
  else{fn='historico_discursos.xlsx';rows=[['Data','Orador','Congregação','Telefone','Nº Tema','Tema']];[...discursos].sort((a,b)=>a.data>b.data?1:-1).forEach(d=>rows.push([d.data,d.nome||'',d.congregacao||'',d.telefone||'',d.temaNum||'',d.tema||'']));}
  const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Dados');XLSX.writeFile(wb,fn);
  toast('◈ Exportado!');closeM('mExport');
}

