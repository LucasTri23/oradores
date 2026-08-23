// HOME
function mkWeekCard(sem,isCurrent,isPast,isFirst){
  const nT=sem.temaNum;
  const nomeT=nT&&TL[nT]?TL[nT]:sem.tema||'';
  const temOr=sem.nome&&!ehSist(sem.nome);
  // Look up telefone from oradores if missing in programa entry
  let tel=sem.telefone||'';
  let congregacao=sem.congregacao||'';
  if(sem.nome){
    const orCad=oradores.find(o=>o.nome===sem.nome);
    if(orCad){
      if(orCad.tel)tel=orCad.tel;
      if(orCad.cong)congregacao=orCad.cong;
    }
  }
  const semComTel={...sem,telefone:tel,congregacao};
  const semJson=JSON.stringify(semComTel);
  const temDados=!!(sem.nome||sem.temaNum||sem.tema);
  const isSemDisc=!!(sem.semDiscurso);
  const isEspecial=isSemDisc||(sem.motivo&&sem.motivo.trim().length>0);
  const isLarge=isCurrent||isFirst;

  // Border color
  let bg,brd;
  if(isEspecial){bg='rgba(245,158,11,.06)';brd='rgba(245,158,11,.35)';}
  else if(isCurrent){bg='linear-gradient(135deg,rgba(37,99,235,.16),rgba(37,99,235,.04))';brd='rgba(37,99,235,.42)';}
  else if(temOr){bg='var(--surf)';brd='var(--border)';}
  else if(temDados){bg='var(--surf)';brd='rgba(239,68,68,.35)';}
  else{bg='rgba(255,255,255,.02)';brd='rgba(239,68,68,.22)';}

  const el=document.createElement('div');
  el.style.cssText='background:'+bg+';border:1px solid '+brd+';border-radius:10px;padding:'+(isLarge?'18px':'11px 14px')+';position:relative;margin-bottom:6px';

  // Date label
  const dateEl=document.createElement('div');
  dateEl.style.cssText='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:'+(isCurrent?'var(--pur3)':isEspecial?'var(--amber)':'var(--whi2)')+';margin-bottom:'+(isLarge?'6px':'3px');
  dateEl.textContent='📅 '+fDSem(sem.data);
  el.appendChild(dateEl);

  if(isEspecial){
    // Yellow special date
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:'+(isLarge?'15px':'13px')+';font-weight:700;color:var(--amber)';
    lbl.textContent='🌟 '+(sem.motivo||'Data especial');
    el.appendChild(lbl);
  } else if(!temDados){
    // No data at all
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px';
    const lbl=document.createElement('span');
    lbl.style.cssText='font-size:12px;color:var(--red);font-style:italic';
    lbl.textContent='⚠ Sem orador definido';
    const btn=document.createElement('button');btn.className='btn bp bs';btn.textContent='+ Definir';
    btn.onclick=function(){editarAgend(semJson);};
    row.appendChild(lbl);row.appendChild(btn);
    el.appendChild(row);
  } else {
    // ORADOR é o foco principal — tema vem abaixo com destaque
    if(temOr){
      // Nome do orador — GRANDE em todos os cards
      const nEl=document.createElement('div');
      nEl.style.cssText='font-family:Space Grotesk,sans-serif;font-weight:700;letter-spacing:-.02em;color:var(--whi);line-height:1.15;margin-bottom:2px;font-size:'+(isLarge?'22px':'16px');
      nEl.textContent=sem.nome;
      el.appendChild(nEl);
      // Congregação
      const cEl=document.createElement('div');
      cEl.style.cssText='font-size:'+(isLarge?'13px':'11px')+';color:var(--whi3);margin-bottom:'+(isLarge?'12px':'8px');
      cEl.textContent=(congregacao||'—')+(tel?' · '+tel:'');
      el.appendChild(cEl);
      // Tema — destaque mas menor que o nome
      if(nT||nomeT){
        const tWrap=document.createElement('div');
        tWrap.style.cssText='padding:'+(isLarge?'10px 12px':'7px 10px')+';background:rgba(0,0,0,.2);border-radius:8px;margin-bottom:'+(isLarge?'12px':'0');
        if(nT){const b=document.createElement('span');b.className='badge bpur';b.style.cssText='margin-bottom:5px;display:inline-block;font-size:10px';b.textContent='Tema nº '+nT;tWrap.appendChild(b);}
        if(nomeT){
          const tEl=document.createElement('div');
          tEl.style.cssText='font-size:'+(isLarge?'14px':'12px')+';font-weight:600;color:var(--whi2);line-height:1.4';
          tEl.textContent=nomeT;
          tWrap.appendChild(tEl);
        }
        el.appendChild(tWrap);
      }
      // Botão WA — abre direto no WhatsApp já com a mensagem pronta
      if(isLarge){
        const btnWrap=document.createElement('div');btnWrap.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
        const wa=document.createElement('button');wa.className='btn bgn bs';wa.textContent='💬 WhatsApp';wa.onclick=function(){abrirMsgPadrao(semJson);};btnWrap.appendChild(wa);
        el.appendChild(btnWrap);
      } else {
        // Small card: botão compacto ao lado do tema já renderizado acima
        const btnWrap=document.createElement('div');btnWrap.style.cssText='display:flex;gap:4px;margin-top:6px';
        const wa=document.createElement('button');wa.className='btn bgn bs';wa.textContent='💬';wa.onclick=function(){abrirMsgPadrao(semJson);};btnWrap.appendChild(wa);
        el.appendChild(btnWrap);
      }
    } else {
      // Sem orador — tema em destaque e botão definir
      if(nT||nomeT){
        if(nT){const b=document.createElement('span');b.className='badge bpur';b.style.cssText='margin-bottom:4px;display:inline-block';b.textContent='Tema nº '+nT;el.appendChild(b);}
        if(nomeT){const tEl=document.createElement('div');tEl.style.cssText='font-size:'+(isLarge?'15px':'13px')+';font-weight:600;color:var(--whi2);margin-bottom:8px;line-height:1.4';tEl.textContent=nomeT;el.appendChild(tEl);}
      }
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 0';
      const lbl=document.createElement('span');lbl.style.cssText='font-size:11px;color:var(--red)';lbl.textContent='⚠ Orador não definido';
      const btn=document.createElement('button');btn.className='btn bp bs';btn.textContent='+ Definir';btn.onclick=function(){editarAgend(semJson);};
      row.appendChild(lbl);row.appendChild(btn);el.appendChild(row);
    }
    if(sem.obs){const o=document.createElement('div');o.style.cssText='font-size:11px;color:var(--pur3);margin-top:5px';o.textContent='⚡ '+sem.obs;el.appendChild(o);}
  }

  // Tema d'A Sentinela desta semana — mostra se já souber (salvo ou já buscado antes),
  // senão busca em segundo plano no jw.org e só aparece se/quando achar (não polui o card com "carregando").
  if(!isEspecial){
    const salvo=sentinelas.find(s=>s.data===sem.data);
    if(salvo){
      const sentEl=document.createElement('div');
      sentEl.style.cssText='font-size:11px;color:var(--pur3);margin-top:6px';
      sentEl.innerHTML='📖 <strong>Estudo A Sentinela:</strong> '+salvo.tema;
      el.appendChild(sentEl);
    } else if((new Date(sem.data+'T12:00:00')-new Date())/864e5<=130){
      fetchTemaJW(sem.data).then(titulo=>{
        if(titulo&&el.isConnected){
          const sentEl=document.createElement('div');
          sentEl.style.cssText='font-size:11px;color:var(--pur3);margin-top:6px';
          sentEl.innerHTML='📖 <strong>Estudo A Sentinela:</strong> '+titulo;
          el.insertBefore(sentEl,el.lastElementChild); // antes do botão de editar
          registrarSentinelaAuto(sem.data,titulo);
        }
      });
    }
  }

  // Edit button (future only)
  const eb=document.createElement('button');
  eb.style.cssText='position:absolute;top:7px;right:7px;background:none;border:none;cursor:pointer;color:var(--whi3);font-size:11px;padding:3px 6px;border-radius:4px';
  eb.textContent='✏️';eb.onclick=function(){editarAgend(semJson);};
  el.appendChild(eb);
  if(sem.id){
    const dbtn=document.createElement('button');
    dbtn.style.cssText='position:absolute;top:7px;right:35px;background:none;border:none;cursor:pointer;color:var(--red);font-size:12px;padding:3px 6px;border-radius:4px';
    dbtn.textContent='🗑';dbtn.title='Excluir discurso';dbtn.onclick=function(){delAgend(sem.id,sem.data);};el.appendChild(dbtn);
  }

  return el;
}
let anoAtivo=new Date().getFullYear(),anosExtras=new Set();
function addAno(){
  const sugerido=Math.max(new Date().getFullYear(),anoAtivo,...programa.map(p=>+(p.data||'0').slice(0,4)),...anosExtras)+1;
  const valor=prompt('Qual ano deseja adicionar?',sugerido);if(!valor)return;
  const ano=+valor;if(!Number.isInteger(ano)||ano<2000||ano>2200)return toast('Informe um ano válido.');
  anosExtras.add(ano);anoAtivo=ano;initAnoFilter();renderHome();
}

function initAnoFilter(){
  const anos=new Set();
  const hoje=new Date().getFullYear();
  [hoje,hoje+1,hoje+2].forEach(a=>anos.add(a));
  programa.forEach(p=>{if(p.data)anos.add(parseInt(p.data.slice(0,4)));});
  anosExtras.forEach(a=>anos.add(a));
  const sorted=[...anos].sort();
  const bar=document.getElementById('anoFilterBar');
  if(!bar)return;
  bar.innerHTML='';
  sorted.forEach(a=>{
    const chip=document.createElement('div');
    chip.className='fchip'+(a===anoAtivo?' on':'');
    chip.style.cssText='font-size:12px;padding:5px 13px';
    chip.textContent=a;
    chip.onclick=function(){setAno(a);};
    bar.appendChild(chip);
  });
}

function setAno(a){
  anoAtivo=+a;
  document.querySelectorAll('#anoFilterBar .fchip').forEach(el=>el.classList.toggle('on',+el.textContent===anoAtivo));
  renderHome();
}

function allMeetingDays(year){
  const sats=[];
  let d=new Date(year,0,1);
  const target=Number(cfg.dia)===0?0:6;
  while(d.getDay()!==target)d.setDate(d.getDate()+1);
  while(d.getFullYear()===year){
    sats.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate()+7);
  }
  return sats;
}

let mesAtivo=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function isoLocal(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
function mudarMes(delta){mesAtivo=new Date(mesAtivo.getFullYear(),mesAtivo.getMonth()+delta,1);renderHome();}
function irMesAtual(){mesAtivo=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderHome();}

function renderHome(){
  const hoje=new Date().toISOString().slice(0,10),byDate={};
  discursos.forEach(p=>{if(p.data)byDate[p.data]={...p,_origem:'discurso'};});
  programa.forEach(p=>{if(p.data)byDate[p.data]={...p,_origem:'programa'};});

  // O card da semana permanece como principal destaque da página.
  const destaque=currentOrNextProg(),dataDestaque=destaque?.data||nextSab();
  const week=document.getElementById('homeWeekCard');
  if(week){week.innerHTML='';week.appendChild(mkWeekCard(destaque||byDate[dataDestaque]||{data:dataDestaque},true,false,true));}

  const ano=mesAtivo.getFullYear(),mes=mesAtivo.getMonth();
  const diasReuniao=allMeetingDays(ano).filter(iso=>Number(iso.slice(5,7))===mes+1);
  const pendencias=diasReuniao.filter(data=>data>=hoje&&!byDate[data]?.semDiscurso&&(!byDate[data]?.nome||!byDate[data]?.temaNum)).length;
  const pending=document.getElementById('pendingCount');if(pending)pending.textContent=pendencias;
  renderCalendar(byDate);
  renderSentinelaChip();
  if(window.lucide)lucide.createIcons();
}

function renderCalendar(byDate){
  const grid=document.getElementById('homeCalendar'),title=document.getElementById('calendarTitle');if(!grid||!title)return;
  const ano=mesAtivo.getFullYear(),mes=mesAtivo.getMonth(),hoje=new Date().toISOString().slice(0,10);
  title.textContent=mesAtivo.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  grid.innerHTML='';
  const datas=allMeetingDays(ano).filter(iso=>Number(iso.slice(5,7))===mes+1);
  datas.forEach(iso=>{
    const registro=byDate[iso]||{data:iso},especial=!!registro.semDiscurso;
    const apenasHistorico=registro._origem==='discurso';
    const completo=especial||!!(registro.nome&&registro.temaNum),pendente=!completo;
    const tema=registro.temaNum?(TL[registro.temaNum]||registro.tema||'Tema não encontrado'):(registro.tema||'');
    const faltas=[];if(!especial&&!registro.nome)faltas.push('orador');if(!especial&&!registro.temaNum)faltas.push('tema');
    const row=document.createElement('article');
    row.className='agenda-row '+(especial?'is-special':completo?'is-ready':'is-pending')+(iso<hoje?' is-past':'')+(iso===hoje?' is-today':'');
    row.onclick=()=>apenasHistorico?irTab('programa'):editarAgend(JSON.stringify(registro));

    const date=document.createElement('div');date.className='agenda-date';
    date.innerHTML='<strong>'+iso.slice(8,10)+'</strong><span>'+new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')+'</span>';

    const info=document.createElement('div');info.className='agenda-info';
    if(especial){const speaker=document.createElement('div');speaker.className='agenda-speaker';speaker.textContent=registro.motivo||'Sem discurso nesta data';const meta=document.createElement('div');meta.className='agenda-meta';meta.textContent='Evento especial';info.appendChild(speaker);info.appendChild(meta);}
    else{
      const speaker=document.createElement('div');speaker.className='agenda-speaker'+(!registro.nome?' missing':'');speaker.textContent=registro.nome||'Orador ainda não definido';
      const meta=document.createElement('div');meta.className='agenda-meta';meta.textContent=registro.nome?(registro.congregacao||'Congregação não informada'):'Clique para preencher a programação';
      info.appendChild(speaker);info.appendChild(meta);
    }

    const topic=document.createElement('div');topic.className='agenda-topic';
    if(especial)topic.innerHTML='<span class="agenda-status special">Evento</span>';
    else if(tema){const number=document.createElement('span');number.className='topic-number';number.textContent='Tema '+registro.temaNum;const topicName=document.createElement('strong');topicName.textContent=tema;topic.appendChild(number);topic.appendChild(topicName);}
    else topic.innerHTML='<span class="agenda-status pending">Tema pendente</span>';

    const action=document.createElement('button');action.className='agenda-action';action.type='button';
    action.innerHTML='<i data-lucide="'+(apenasHistorico?'eye':pendente?'circle-plus':'pencil')+'"></i><span>'+(apenasHistorico?'Ver':pendente?'Completar':'Editar')+'</span>';
    action.onclick=e=>{e.stopPropagation();apenasHistorico?irTab('programa'):editarAgend(JSON.stringify(registro));};

    const status=document.createElement('div');status.className='agenda-state';
    status.innerHTML=especial?'<i class="status-dot special"></i><span>Especial</span>':completo?'<i class="status-dot ready"></i><span>Completo</span>':'<i class="status-dot pending"></i><span>Falta '+faltas.join(' e ')+'</span>';
    row.appendChild(date);row.appendChild(info);row.appendChild(topic);row.appendChild(status);row.appendChild(action);grid.appendChild(row);
  });
}
function renderSentinelaChip(){
  const sd=document.getElementById('homeSentinela');
  if(!sd)return;
  const alvo=nextSab();
  const us=sentinelas.find(s=>s.data===alvo)||(sentinelas.length?sentinelas[0]:null);
  if(us){
    const sc=document.createElement('div');sc.className='sentchip';
    sc.innerHTML='📖 <strong>Sentinela:</strong> '+us.tema+(us.data?' <span style="opacity:.6;margin-left:6px">'+fD(us.data)+'</span>':'');
    sd.innerHTML='';sd.appendChild(sc);
    return;
  }
  sd.innerHTML='';
  const loading=document.createElement('div');loading.className='sentchip';loading.style.cssText='opacity:.5';
  loading.textContent='📖 Buscando o tema da Sentinela...';
  sd.appendChild(loading);
  fetchTemaJW(alvo).then(titulo=>{
    if(!sd.isConnected)return;
    sd.innerHTML='';
    if(titulo){
      const sc=document.createElement('div');sc.className='sentchip';
      sc.innerHTML='📖 <strong>Sentinela:</strong> '+titulo+' <span style="opacity:.6;margin-left:6px">'+fD(alvo)+'</span>';
      sd.appendChild(sc);
      registrarSentinelaAuto(alvo,titulo);
    } else {
      const sc2=document.createElement('div');sc2.className='sentchip';sc2.style.cssText='opacity:.4;cursor:pointer';
      sc2.textContent='📖 Não encontrei automaticamente — toque para preencher manual';sc2.onclick=function(){irTab('sentinela');};
      sd.appendChild(sc2);
    }
  });
}
