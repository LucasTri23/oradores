// TEMAS
function setTF(el){document.querySelectorAll('.fchip').forEach(x=>x.classList.remove('on'));el.classList.add('on');temaFiltro=el.dataset.f;renderTemas();}
function renderTemas(){
  const q=(document.getElementById('temaSearch')?.value||'').toLowerCase().trim();
  const div=document.getElementById('temasLista');if(!div)return;
  const entries=Object.entries(TL).map(([n,t])=>({n:+n,t})).sort((a,b)=>a.n-b.n);
  div.innerHTML='';
  let found=0;
  entries.forEach(({n,t})=>{
    const bloqueado=bloqueados.has(n);
    const editado=TEMAS[n]&&t!==TEMAS[n]&&!bloqueado;
    const usosTema=[...discursos,...programa.filter(p=>p.data&&p.data<=new Date().toISOString().slice(0,10)&&!p.semDiscurso)]
      .filter(d=>d.temaNum==n).filter((d,i,a)=>a.findIndex(x=>x.data===d.data&&x.temaNum==d.temaNum)===i);
    const u=usosTema.length;
    if(!bloqueado){
      if(temaFiltro==='0'&&u>0)return;
      if(temaFiltro==='1'&&u!==1)return;
      if(temaFiltro==='2'&&u!==2)return;
      if(temaFiltro==='3'&&u<3)return;
    }
    if(q&&!String(n).includes(q)&&!t.toLowerCase().includes(q))return;
    found++;
    const row=document.createElement('div');
    row.className='tema-row';
    if(bloqueado)row.style.cssText='opacity:.5;border-color:rgba(239,68,68,.25)';
    // Número
    const numEl=document.createElement('div');
    numEl.style.cssText='min-width:34px;text-align:center;font-size:11px;font-weight:700;color:'+(bloqueado?'var(--red)':u===0?'var(--green)':'var(--pur3)');
    numEl.textContent=n;
    row.appendChild(numEl);
    // Info
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
    const ult=[...usosTema].sort((a,b)=>(b.data||'').localeCompare(a.data||''))[0]?.data;
    const tEl=document.createElement('div');
    tEl.style.cssText='font-size:13px;'+(bloqueado?'color:var(--red);text-decoration:line-through':'');
    tEl.textContent=t;
    info.appendChild(tEl);
    const subEl=document.createElement('div');
    subEl.style.cssText='font-size:11px;color:var(--whi3);margin-top:1px';
    subEl.textContent=bloqueado?'Tema bloqueado':(u?'Usado '+u+'× · último: '+fD(ult):'Nunca usado');
    info.appendChild(subEl);
    row.appendChild(info);
    // Ações
    const acts=document.createElement('div');acts.style.cssText='display:flex;gap:4px;align-items:center;flex-shrink:0';
    // Editar nome
    const eb=document.createElement('button');eb.className='btn bo bs';eb.style.cssText='font-size:10px;padding:3px 7px;opacity:.5';eb.textContent='✏️';eb.title='Editar nome do tema';
    eb.onclick=function(e){e.stopPropagation();editTemaNome(n);};acts.appendChild(eb);
    if(editado){const bE=document.createElement('span');bE.className='badge bamb';bE.style.cssText='font-size:9px';bE.textContent='Editado';acts.appendChild(bE);}
    if(!bloqueado){
      if(u===0){const bN=document.createElement('span');bN.className='badge bgrn';bN.textContent='Novo';acts.appendChild(bN);}
      const tb=document.createElement('button');tb.className='btn bo bs';tb.style.cssText='font-size:10px;padding:3px 7px;opacity:.6';tb.textContent='🚫';tb.title='Bloquear tema';
      tb.onclick=function(e){e.stopPropagation();toggleTemaDisp(n);};acts.appendChild(tb);
    } else {
      const lb2=document.createElement('span');lb2.className='badge bred';lb2.textContent='Bloqueado';acts.appendChild(lb2);
      const tb=document.createElement('button');tb.className='btn bo bs';tb.style.cssText='font-size:10px;padding:3px 7px';tb.textContent='✓ Liberar';
      tb.onclick=function(e){e.stopPropagation();toggleTemaDisp(n);};acts.appendChild(tb);
    }
    row.appendChild(acts);
    div.appendChild(row);
  });
  if(!found)div.innerHTML='<div class="empty"><div class="ico">🔍</div>Nenhum tema encontrado</div>';
}

function toggleTemaDisp(n){
  n=+n;
  if(bloqueados.has(n)){bloqueados.delete(n);toast('Tema Nº '+n+' liberado!');}
  else{bloqueados.add(n);toast('Tema Nº '+n+' bloqueado.');}
  salvarConfigTemas();
  renderTemas();
}
function editTemaNome(n){
  const atual=TL[n]||'';
  const novo=prompt('Editar nome do Tema Nº '+n+':',atual);
  if(novo===null)return;
  const trimmed=novo.trim();
  if(!trimmed)return toast('Nome não pode ser vazio.');
  TL[n]=trimmed;
  salvarConfigTemas();
  renderTemas();
  toast('Tema Nº '+n+' atualizado!');
}

// ORADORES
function setOrSort(el){
  document.querySelectorAll('[data-or]').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');orSort=el.dataset.or;renderOradores();
}

async function loadOradores(){if(!db)return;const s=await FF.gets(FF.col(db,'oradores'));oradores=s.docs.map(d=>({id:d.id,...d.data()}));renderOradores();if(document.getElementById('page-home').classList.contains('active'))renderHome();}
function renderOradores(){
  const q=(document.getElementById('buscaOr')?.value||'').toLowerCase();
  const list=oradores.filter(o=>o.nome?.toLowerCase().includes(q)||o.cong?.toLowerCase().includes(q));
  const div=document.getElementById('listaOr');if(!div)return;
  if(!list.length){div.innerHTML='<div class="empty"><div class="ico">👤</div>Nenhum orador</div>';return;}
  const hoje=new Date().toISOString().slice(0,10);
  const agMap={};
  programa.forEach(p=>{
    if(!p.nome||ehSist(p.nome))return;
    if(p.data>=hoje){const o=oradores.find(x=>x.nome===p.nome);if(o&&!agMap[o.id])agMap[o.id]=p.data;}
  });
  div.innerHTML='';
  const hoje2=new Date().toISOString().slice(0,10);
  // Sort
  if(orSort==='mais') list.sort((a,b)=>{
    const ma=new Date(getUltimoDiscurso(a)||0);
    const mb=new Date(getUltimoDiscurso(b)||0);
    return ma-mb; // oldest first
  });
  else if(orSort==='menos') list.sort((a,b)=>{
    const ma=new Date(getUltimoDiscurso(a)||0);
    const mb=new Date(getUltimoDiscurso(b)||0);
    return mb-ma; // newest first
  });
  else if(orSort==='agendado') list.sort((a,b)=>{
    const aa=agMap[a.id]?0:1;const ab=agMap[b.id]?0:1;return aa-ab;
  });
  else list.sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
  list.forEach(o=>{
    const ultimo=getUltimoDiscurso(o);
    const cor=corTempo(ultimo);
    const tempo=mesesAno(ultimo);
    const ag=agMap[o.id];
    const row=document.createElement('div');
    row.className='or-item';
    let ih='<div style="min-width:0;flex:1"><div style="font-weight:600;font-size:13px">'+o.nome;
    if(o.nota)ih+='&nbsp;<span style="color:var(--amber);font-size:11px">'+'★'.repeat(o.nota)+'</span>';
    if(ag)ih+='&nbsp;<span class="badge bblu">AGENDADO '+fD(ag)+'</span>';
    ih+='</div><div style="font-size:11px;color:var(--whi3);margin-top:2px">'+(o.cong||'—')+' · '+(o.tel||'sem contato')+'</div>';
    if(tempo)ih+='<div style="font-size:11px;margin-top:3px"><span class="badge '+cor+'">'+tempo+' sem discursar</span></div>';
    if(o.obs)ih+='<div style="font-size:11px;color:var(--whi3);margin-top:2px;font-style:italic">"'+o.obs+'"</div>';
    ih+='</div>';
    row.innerHTML=ih;
    const btns=document.createElement('div');
    btns.style.cssText='display:flex;gap:4px;flex-shrink:0';
    if(o.tel){const b=document.createElement('button');b.className='btn bo bs';b.title='Escolher mensagem para WhatsApp';b.innerHTML='<i data-lucide="message-circle-more"></i><span>Mensagem</span>';b.onclick=()=>abrirMensagensOrador(o.id);btns.appendChild(b);}
    const be=document.createElement('button');be.className='btn bo bs';be.title='Editar';be.textContent='✏️';be.onclick=()=>editOrador(o.id);btns.appendChild(be);
    const bd=document.createElement('button');bd.className='btn bo bs';bd.style.cssText='color:var(--red);opacity:.7';bd.title='Excluir';bd.textContent='🗑';bd.onclick=()=>delOrador(o.id);btns.appendChild(bd);
    row.appendChild(btns);
    div.appendChild(row);
  });
  if(window.lucide)lucide.createIcons();
}
function novoOrador(){['oId','oNome','oCong','oTel','oUlt','oObs'].forEach(id=>document.getElementById(id).value='');notaAtual=0;rStars(0);document.getElementById('mOradorTit').textContent='Novo Orador';openM('mOrador');}
function editOrador(id){
  const o=oradores.find(x=>x.id===id);if(!o)return;
  document.getElementById('oId').value=id;document.getElementById('oNome').value=o.nome||'';document.getElementById('oCong').value=o.cong||'';
  document.getElementById('oTel').value=o.tel||'';document.getElementById('oUlt').value=o.ultimoDiscurso||'';document.getElementById('oObs').value=o.obs||'';
  notaAtual=o.nota||0;rStars(notaAtual);document.getElementById('mOradorTit').textContent='Editar Orador';openM('mOrador');
}
async function saveOrador(){
  if(!db)return toast('Supabase não conectado!');
  const id=document.getElementById('oId').value;
  const data={nome:document.getElementById('oNome').value.trim(),cong:document.getElementById('oCong').value.trim(),tel:document.getElementById('oTel').value.trim(),ultimoDiscurso:document.getElementById('oUlt').value,obs:document.getElementById('oObs').value.trim(),nota:notaAtual};
  if(!data.nome)return toast('Informe o nome!');
  if(id)await FF.upd(FF.doc(db,'oradores',id),data);else await FF.add(FF.col(db,'oradores'),data);
  closeM('mOrador');await loadOradores();toast('✓ Salvo!');
}
async function delOrador(id){if(!confirm('Excluir?'))return;await FF.del(FF.doc(db,'oradores',id));await loadOradores();toast('Excluído.');}
document.querySelectorAll('#starsEl .star').forEach(s=>{s.addEventListener('click',()=>{notaAtual=+s.dataset.v;rStars(notaAtual);});s.addEventListener('mouseover',()=>rStars(+s.dataset.v));s.addEventListener('mouseout',()=>rStars(notaAtual));});
function rStars(v){document.querySelectorAll('#starsEl .star').forEach(s=>s.classList.toggle('on',+s.dataset.v<=v));}

// DISCURSOS
async function loadDiscursos(){if(!db)return;const s=await FF.gets(FF.col(db,'discursos'));discursos=s.docs.map(d=>({id:d.id,...d.data()}));}

