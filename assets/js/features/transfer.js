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
async function compartilharOradores(){
  if(!supabase||!currentUser)return toast('Entre com Google primeiro.');
  if(!oradores.length)return toast('Não há oradores para compartilhar.');
  if(!confirm('Gerar um link com nome, congregação, telefone e demais dados dos '+oradores.length+' oradores? O link expira em 7 dias.'))return;
  try{
    const copia=oradores.map(({id,...o})=>o);
    const{data,error}=await supabase.from('speaker_shares').insert({payload:copia}).select('token').single();if(error)throw error;
    const link=location.origin+location.pathname+'?import='+encodeURIComponent(data.token);
    if(navigator.share){await navigator.share({title:'Lista de oradores',text:'Abra o link, entre com Google e importe a lista de oradores:',url:link});}
    else{await navigator.clipboard.writeText(link);toast('✓ Link copiado! Ele expira em 7 dias.',4500);}
  }catch(e){if(e.name!=='AbortError')toast('Erro ao compartilhar: '+e.message,5000);}
}
async function checkSharedImport(){
  const token=new URLSearchParams(location.search).get('import');if(!token||!supabase||!currentUser)return;
  try{
    const{data,error}=await supabase.rpc('get_shared_speakers',{share_token:token});if(error)throw error;
    const lista=Array.isArray(data)?data:[];if(!lista.length)throw new Error('Este link expirou ou não existe.');
    if(confirm('Esta lista compartilhada contém '+lista.length+' oradores. Deseja copiar para sua conta?')){
      const existentes=new Set(oradores.map(chaveIdentidadeOrador));let novos=0;
      for(const o of lista){const chave=chaveIdentidadeOrador(o);if(o.nome&&!existentes.has(chave)){await FF.add(FF.col(db,'oradores'),o);existentes.add(chave);novos++;}}
      await loadOradores();toast('✓ '+novos+' oradores importados; '+(lista.length-novos)+' duplicados ignorados.',5000);
    }
  }catch(e){toast('Não foi possível importar a lista: '+e.message,5000);}
  finally{history.replaceState({},'',location.pathname+location.hash);}
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

