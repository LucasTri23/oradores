// Regras do módulo Designações (sem tela): funções, datas das reuniões, tempo sem fazer, conflitos e sugestões.
(function(raiz){
  const FUNCOES={
    presidente:{nome:'Presidente',icone:'user-round'},
    leitor:{nome:'Leitor de A Sentinela',curto:'Leitor',icone:'book-open'},
    indicadores:{nome:'Indicadores',icone:'door-open'},
    zoom:{nome:'Indicador do Zoom',curto:'Zoom',icone:'video'},
    microfones:{nome:'Microfones',icone:'mic'},
    audio_video:{nome:'Áudio e vídeo',icone:'monitor-speaker'}
  };
  const FUNCOES_POR_TIPO={
    meio:['indicadores','zoom','microfones','audio_video'],
    fim:['presidente','leitor','indicadores','zoom','microfones','audio_video']
  };
  const TIPOS={meio:'Meio de semana',fim:'Fim de semana'};
  const QTD_PADRAO={
    meio:{indicadores:2,zoom:1,microfones:2,audio_video:1},
    fim:{presidente:1,leitor:1,indicadores:2,zoom:1,microfones:2,audio_video:1}
  };
  // Nome de cada vaga (como no quadro de anúncios): Indicadores → Auditório/Entrada, etc.
  const ROTULOS_VAGAS={indicadores:['Auditório','Entrada'],microfones:['Microfone 1','Microfone 2'],audio_video:['Áudio','Vídeo']};
  function rotuloVaga(funcao,i,total){
    if(total<=1)return FUNCOES[funcao].nome;
    return ROTULOS_VAGAS[funcao]?.[i]||((FUNCOES[funcao].curto||FUNCOES[funcao].nome)+' '+(i+1));
  }
  const GRUPOS={anciao:'Anciãos',servo:'Servos ministeriais',publicador:'Publicadores','':'Sem grupo definido'};
  const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const normalizar=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const diasEntre=(de,ate)=>Math.round((new Date(ate+'T12:00:00')-new Date(de+'T12:00:00'))/864e5);

  function quantidades(cfg){
    const q=cfg?.quantidades||{};
    const r={};
    Object.keys(QTD_PADRAO).forEach(t=>{r[t]={};FUNCOES_POR_TIPO[t].forEach(f=>{const v=Number(q[t]?.[f]);r[t][f]=Number.isInteger(v)&&v>=0&&v<=6?v:QTD_PADRAO[t][f];});});
    return r;
  }

  // Dia do fim de semana: usa a configuração do Oradores quando existe (inclusive a regra de 2027).
  function diaFimDoAno(ano,cfg){
    const o=cfg?.oradores;
    if(o){if(ano===2027&&(o.dia2027===0||o.dia2027===6))return o.dia2027;if(o.dia===0||o.dia===6)return o.dia;}
    return cfg?.diaFim===0?0:6;
  }

  // Reuniões de um mês: datas pelos dias configurados + reuniões salvas em outros dias (remarcadas).
  function reunioesDoMes(ano,mes,cfg,salvas=[]){
    const lista=new Map();
    const ultimo=new Date(ano,mes,0).getDate();
    for(let d=1;d<=ultimo;d++){
      const dt=new Date(ano,mes-1,d),dia=dt.getDay();
      if(cfg?.diaMeio!=null&&dia===Number(cfg.diaMeio))lista.set(iso(dt),{data:iso(dt),tipo:'meio'});
      if(dia===diaFimDoAno(ano,cfg))lista.set(iso(dt),{data:iso(dt),tipo:'fim'});
    }
    const prefixo=ano+'-'+String(mes).padStart(2,'0');
    salvas.filter(r=>r.data?.startsWith(prefixo)).forEach(r=>lista.set(r.data,{...lista.get(r.data),...r}));
    return [...lista.values()].sort((a,b)=>a.data.localeCompare(b.data));
  }

  // A outra reunião da mesma semana (meio ↔ fim). Usada no Indicador do Zoom semanal.
  function parSemanal(data,tipo,cfg){
    if(cfg?.diaMeio==null)return null;
    const base=new Date(data+'T12:00:00');
    for(let k=1;k<=6;k++){
      const d=new Date(base);d.setDate(base.getDate()+(tipo==='meio'?k:-k));
      const alvo=tipo==='meio'?diaFimDoAno(d.getFullYear(),cfg):Number(cfg.diaMeio);
      if(d.getDay()===alvo)return iso(d);
    }
    return null;
  }
  const zoomSemanal=cfg=>cfg?.zoomSemanal!==false;
  // Segunda-feira da semana (para agrupar o Zoom no quadro).
  function segundaDaSemana(data){const d=new Date(data+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);}

  const pessoasDe=(reuniao,funcao)=>(reuniao?.pessoas?.[funcao]||[]).filter(Boolean);
  const valida=r=>r&&r.data&&!r.semReuniao;

  // Última data (antes de "antesDe") em que a pessoa fez a função.
  function ultimaVez(reunioes,pessoaId,funcao,antesDe){
    let ultima=null;
    reunioes.forEach(r=>{if(valida(r)&&r.data<antesDe&&pessoasDe(r,funcao).includes(pessoaId)&&(!ultima||r.data>ultima))ultima=r.data;});
    return ultima;
  }
  function tempoSem(ultima,ref){
    if(!ultima)return 'nunca fez';
    const d=diasEntre(ultima,ref);
    if(d<7)return 'há '+d+(d===1?' dia':' dias');
    const s=Math.floor(d/7);
    if(s<9)return 'há '+s+(s===1?' semana':' semanas');
    const m=Math.floor(d/30.4);
    return 'há '+m+(m===1?' mês':' meses');
  }

  // Avisos para uma pessoa em uma função de uma reunião. "oradores" = {programa, discursantes} do módulo Oradores.
  function conflitos({reuniao,pessoa,funcao,reunioes=[],oradores={}}){
    const avisos=[];if(!pessoa||!reuniao)return avisos;
    Object.keys(FUNCOES).forEach(f=>{
      if(f!==funcao&&pessoasDe(reuniao,f).includes(pessoa.id))avisos.push('Também está em '+FUNCOES[f].nome+' nesta reunião');
    });
    const nome=normalizar(pessoa.nome);
    (oradores.programa||[]).forEach(p=>{
      if(p.data===reuniao.data&&!p.semDiscurso&&normalizar(p.nome)===nome)avisos.push('É o orador do discurso público neste dia');
    });
    (oradores.discursantes||[]).forEach(d=>{
      if(normalizar(d.nome)!==nome)return;
      const saidas=Array.isArray(d.saidas)?d.saidas:[];
      const fora=[...saidas,...(d.proxSaida?[{data:d.proxSaida,destino:d.destino}]:[])].find(s=>s&&s.data===reuniao.data);
      if(fora)avisos.push('Tem discurso fora neste dia'+(fora.destino?' ('+fora.destino+')':''));
    });
    const anterior=reunioes.filter(r=>valida(r)&&r.tipo===reuniao.tipo&&r.data<reuniao.data).sort((a,b)=>b.data.localeCompare(a.data))[0];
    if(anterior&&pessoasDe(anterior,funcao).includes(pessoa.id))avisos.push('Fez esta função na reunião anterior ('+anterior.data.slice(8,10)+'/'+anterior.data.slice(5,7)+')');
    return [...new Set(avisos)];
  }

  const podeFazer=(p,funcao)=>p&&p.ativo!==false&&!!p.funcoes?.[funcao];

  // Ordena quem pode fazer a função: quem está há mais tempo sem fazer vem primeiro.
  function candidatos({reuniao,funcao,pessoas,reunioes,oradores}){
    return pessoas.filter(p=>podeFazer(p,funcao)).map(p=>{
      const ultima=ultimaVez(reunioes,p.id,funcao,reuniao.data);
      return {pessoa:p,ultima,avisos:conflitos({reuniao,pessoa:p,funcao,reunioes,oradores})};
    }).sort((a,b)=>{
      if(!a.ultima!==!b.ultima)return a.ultima?1:-1;
      if(a.ultima!==b.ultima)return a.ultima.localeCompare(b.ultima);
      return a.pessoa.nome.localeCompare(b.pessoa.nome,'pt-BR');
    });
  }

  // Preenche só as vagas vazias, em ordem de data, sem conflitos e alternando as pessoas.
  function sugerir({reunioesAlvo,todas,pessoas,cfg,oradores}){
    const qtd=quantidades(cfg);
    const historico=new Map(todas.map(r=>[r.data,r]));
    const resultado=[];
    reunioesAlvo.slice().sort((a,b)=>a.data.localeCompare(b.data)).forEach(original=>{
      if(original.semReuniao){resultado.push(original);return;}
      const r={...original,pessoas:{...(original.pessoas||{})}};
      FUNCOES_POR_TIPO[r.tipo].forEach(funcao=>{
        const vagas=qtd[r.tipo][funcao];
        const atual=(r.pessoas[funcao]||[]).slice(0,vagas);
        while(atual.length<vagas)atual.push(null);
        r.pessoas[funcao]=atual;
        for(let i=0;i<vagas;i++){
          if(atual[i])continue;
          historico.set(r.data,r);
          // Zoom semanal: repete quem já está no Zoom na outra reunião da semana.
          if(funcao==='zoom'&&zoomSemanal(cfg)){
            const par=historico.get(parSemanal(r.data,r.tipo,cfg));
            const doPar=par&&!par.semReuniao?pessoasDe(par,'zoom')[i]:null;
            if(doPar&&!Object.values(r.pessoas).some(ids=>(ids||[]).includes(doPar))){atual[i]=doPar;continue;}
          }
          const lista=candidatos({reuniao:r,funcao,pessoas,reunioes:[...historico.values()],oradores})
            .filter(c=>!Object.values(r.pessoas).some(ids=>(ids||[]).includes(c.pessoa.id)));
          const escolha=lista.find(c=>!c.avisos.length)||null;
          if(escolha)atual[i]=escolha.pessoa.id;
        }
      });
      historico.set(r.data,r);
      resultado.push(r);
    });
    return resultado;
  }

  const api={FUNCOES,FUNCOES_POR_TIPO,TIPOS,QTD_PADRAO,GRUPOS,DIAS,ROTULOS_VAGAS,rotuloVaga,parSemanal,zoomSemanal,segundaDaSemana,iso,normalizar,quantidades,diaFimDoAno,reunioesDoMes,pessoasDe,ultimaVez,tempoSem,conflitos,candidatos,sugerir,podeFazer};
  raiz.Regras=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
